import { createSign } from "node:crypto";

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";

import { PrismaService } from "../database/prisma.service";

const invitationJobName = "google-drive-invite";
const driveScope = "https://www.googleapis.com/auth/drive";

type DriveListResponse = { drives?: Array<{ id: string; name: string }>; nextPageToken?: string };
type Permission = { id: string; emailAddress?: string; role?: string; type?: string };
type PermissionListResponse = { permissions?: Permission[]; nextPageToken?: string };

function isGmailAddress(email: string) {
  return /@(gmail\.com|googlemail\.com)$/i.test(email.trim());
}

function encodeJwtPart(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

@Injectable()
export class GoogleDriveInvitationService implements OnModuleInit {
  private readonly logger = new Logger(GoogleDriveInvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue("google-drive-invitations") private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    if (!this.isConfigured()) return;
    const pending = await this.prisma.googleDriveInvitation.findMany({
      where: { status: { in: ["PENDING", "FAILED"] } },
      select: { userId: true },
      take: 500,
    });
    await Promise.all(pending.map(({ userId }) => this.enqueue(userId)));
  }

  async schedule(userId: string, email: string, requestedById: string) {
    if (!isGmailAddress(email)) return;
    await this.prisma.googleDriveInvitation.upsert({
      where: { userId },
      create: {
        userId,
        requestedById,
        email: email.trim().toLowerCase(),
        driveName: this.driveName(),
        role: "writer",
        status: "PENDING",
      },
      update: {
        email: email.trim().toLowerCase(),
        requestedById,
        driveName: this.driveName(),
        role: "writer",
        status: "PENDING",
        lastError: null,
      },
    });
    if (this.isConfigured()) await this.enqueue(userId);
  }

  async process(userId: string) {
    const invitation = await this.prisma.googleDriveInvitation.findUnique({
      where: { userId },
      include: { user: { select: { isActive: true, approvalStatus: true } } },
    });
    if (!invitation || invitation.status === "COMPLETED" || invitation.status === "CANCELLED") return;
    if (!invitation.user.isActive || invitation.user.approvalStatus !== "APPROVED") {
      await this.prisma.googleDriveInvitation.update({ where: { id: invitation.id }, data: { status: "CANCELLED" } });
      return;
    }

    await this.prisma.googleDriveInvitation.update({
      where: { id: invitation.id },
      data: { status: "PROCESSING", attempts: { increment: 1 }, lastError: null },
    });
    try {
      const accessToken = await this.accessToken();
      const driveId = await this.findSharedDrive(accessToken, invitation.driveName);
      const permissionId = await this.ensureWriterPermission(accessToken, driveId, invitation.email);
      await this.prisma.googleDriveInvitation.update({
        where: { id: invitation.id },
        data: { status: "COMPLETED", permissionId, invitedAt: new Date(), lastError: null },
      });
    } catch (reason) {
      const message = (reason instanceof Error ? reason.message : "Google Drive 초대에 실패했습니다.")
        .replaceAll(invitation.email, "[이메일]")
        .slice(0, 500);
      await this.prisma.googleDriveInvitation.update({
        where: { id: invitation.id },
        data: { status: "FAILED", lastError: message },
      });
      throw reason;
    }
  }

  private async enqueue(userId: string) {
    try {
      const jobId = `google-drive-invite-${userId}`;
      const existing = await this.queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (state !== "failed" && state !== "completed") return;
        await existing.remove();
      }
      await this.queue.add(invitationJobName, { userId }, {
        jobId,
        attempts: 5,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      });
    } catch {
      this.logger.warn(`Google Drive 초대 작업을 대기열에 등록하지 못했습니다. userId=${userId}`);
    }
  }

  private isConfigured() {
    return Boolean(
      this.config.get<string>("GOOGLE_SERVICE_ACCOUNT_EMAIL")?.trim() &&
      this.config.get<string>("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")?.trim(),
    );
  }

  private driveName() {
    return this.config.get<string>("GOOGLE_SHARED_DRIVE_NAME", "다우그룹_공유 드라이브").trim();
  }

  private async accessToken() {
    const email = this.config.getOrThrow<string>("GOOGLE_SERVICE_ACCOUNT_EMAIL").trim();
    const privateKey = this.config.getOrThrow<string>("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replaceAll("\\n", "\n");
    const now = Math.floor(Date.now() / 1000);
    const header = encodeJwtPart({ alg: "RS256", typ: "JWT" });
    const payload: Record<string, string | number> = {
      iss: email,
      scope: driveScope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    };
    const subject = this.config.get<string>("GOOGLE_SERVICE_ACCOUNT_SUBJECT")?.trim();
    if (subject) payload.sub = subject;
    const unsigned = `${header}.${encodeJwtPart(payload)}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const assertion = `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    const body = await response.json() as { access_token?: string; error_description?: string };
    if (!response.ok || !body.access_token) throw new Error(body.error_description ?? "Google 서비스 계정 인증에 실패했습니다.");
    return body.access_token;
  }

  private async findSharedDrive(accessToken: string, targetName: string) {
    let pageToken = "";
    do {
      const params = new URLSearchParams({ pageSize: "100", fields: "nextPageToken,drives(id,name)" });
      if (pageToken) params.set("pageToken", pageToken);
      const result = await this.googleRequest<DriveListResponse>(accessToken, `https://www.googleapis.com/drive/v3/drives?${params}`);
      const target = result.drives?.find((drive) => drive.name === targetName);
      if (target) return target.id;
      pageToken = result.nextPageToken ?? "";
    } while (pageToken);
    throw new Error(`대상 공유 드라이브 '${targetName}'을 찾지 못했습니다.`);
  }

  private async ensureWriterPermission(accessToken: string, driveId: string, email: string) {
    let pageToken = "";
    let current: Permission | undefined;
    do {
      const params = new URLSearchParams({
        supportsAllDrives: "true",
        fields: "nextPageToken,permissions(id,emailAddress,role,type)",
        pageSize: "100",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const list = await this.googleRequest<PermissionListResponse>(
        accessToken,
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveId)}/permissions?${params}`,
      );
      current = list.permissions?.find((permission) => permission.emailAddress?.toLowerCase() === email.toLowerCase());
      pageToken = current ? "" : (list.nextPageToken ?? "");
    } while (pageToken);
    if (current?.id) {
      if (current.role !== "writer" && current.role !== "fileOrganizer" && current.role !== "organizer") {
        await this.googleRequest(
          accessToken,
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveId)}/permissions/${encodeURIComponent(current.id)}?supportsAllDrives=true`,
          { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "writer" }) },
        );
      }
      return current.id;
    }
    const params = new URLSearchParams({ supportsAllDrives: "true", sendNotificationEmail: "true" });
    const created = await this.googleRequest<Permission>(
      accessToken,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveId)}/permissions?${params}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "user", role: "writer", emailAddress: email }),
      },
    );
    if (!created.id) throw new Error("Google Drive 초대 권한 ID를 확인하지 못했습니다.");
    return created.id;
  }

  private async googleRequest<T>(accessToken: string, url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: { ...options?.headers, authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(body?.error?.message ?? `Google Drive API 요청에 실패했습니다. (${response.status})`);
    }
    return response.json() as Promise<T>;
  }
}

export { invitationJobName, isGmailAddress };
