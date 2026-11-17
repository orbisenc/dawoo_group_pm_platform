import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { DriveService } from "../drive/drive.service";
import { InputSecurityService } from "../feed/input-security.service";
import type { Actor } from "../projects/collaboration.types";
import { CollaborationService } from "../projects/collaboration.service";
import type { ApprovalListDto, CreateApprovalDto, UpdateApprovalDto } from "./approval.dto";

const detailInclude = {
  createdBy: { select: { id: true, name: true } },
  file: { select: { id: true, name: true } },
  fileVersion: { select: { id: true, version: true, originalName: true, sha256: true, size: true, mimeType: true } },
  routeMembers: { orderBy: { sequence: "asc" as const }, include: { approver: { select: { id: true, name: true } } } },
  revisions: { orderBy: { revision: "desc" as const }, include: { steps: { orderBy: { sequence: "asc" as const }, include: { approver: { select: { id: true, name: true } } } } } },
  actions: { orderBy: { createdAt: "desc" as const }, include: { actor: { select: { id: true, name: true } } } },
} satisfies Prisma.ApprovalDocumentInclude;

@Injectable()
export class ApprovalService {
  constructor(private readonly prisma: PrismaService, private readonly collaboration: CollaborationService, private readonly drive: DriveService, private readonly security: InputSecurityService) {}

  async list(actor: Actor, projectId: string, dto: ApprovalListDto) {
    await this.collaboration.authorizeProject(actor, projectId, false);
    const where: Prisma.ApprovalDocumentWhereInput = { projectId };
    if (dto.scope === "mine") where.createdById = actor.id;
    if (dto.scope === "pending") where.revisions = { some: { steps: { some: { approverId: actor.id, status: "ACTIVE" } } } };
    const items = await this.prisma.approvalDocument.findMany({ where, orderBy: { updatedAt: "desc" }, include: { createdBy: { select: { id: true, name: true } }, file: { select: { id: true, name: true } }, revisions: { orderBy: { revision: "desc" }, take: 1, include: { steps: { orderBy: { sequence: "asc" }, include: { approver: { select: { id: true, name: true } } } } } } } });
    return { items };
  }

  async context(actor: Actor, projectId: string) {
    await this.collaboration.authorizeProject(actor, projectId, false);
    const [files, memberships] = await Promise.all([
      this.drive.listApprovalFiles(actor, projectId),
      this.prisma.projectMembership.findMany({ where: { projectId, status: "ACTIVE", user: { isActive: true } }, orderBy: { user: { name: "asc" } }, select: { user: { select: { id: true, name: true } }, role: true } }),
    ]);
    return { files, members: memberships };
  }

  async detail(actor: Actor, projectId: string, documentId: string) {
    await this.collaboration.authorizeProject(actor, projectId, false);
    const document = await this.prisma.approvalDocument.findFirst({ where: { id: documentId, projectId }, include: detailInclude });
    if (!document) throw new NotFoundException("결재 문서를 찾을 수 없습니다.");
    return this.serialize(document);
  }

  async create(actor: Actor, projectId: string, dto: CreateApprovalDto) {
    await this.collaboration.authorizeProject(actor, projectId, true);
    const { version } = await this.drive.approvalVersion(actor, projectId, dto.fileId, dto.fileVersionId);
    await this.assertApprovers(projectId, dto.approverIds);
    const title = this.security.plainText(dto.title, "결재 제목");
    const content = this.security.plainText(dto.content, "결재 내용");
    const document = await this.prisma.$transaction(async (tx) => {
      const created = await tx.approvalDocument.create({ data: { projectId, createdById: actor.id, fileId: dto.fileId, fileVersionId: version.id, title, content, routeMembers: { create: dto.approverIds.map((approverId, index) => ({ approverId, sequence: index + 1 })) } } });
      await tx.approvalAction.create({ data: { documentId: created.id, actorId: actor.id, type: "CREATED", toStatus: "DRAFT" } });
      await this.audit(tx, actor.id, projectId, created.id, "APPROVAL_CREATED", { status: "DRAFT" });
      return created;
    });
    return this.detail(actor, projectId, document.id);
  }

  async update(actor: Actor, projectId: string, documentId: string, dto: UpdateApprovalDto) {
    await this.collaboration.authorizeProject(actor, projectId, true);
    const current = await this.requireEditable(actor, projectId, documentId);
    const fileId = dto.fileId ?? current.fileId;
    const fileVersionId = dto.fileVersionId ?? current.fileVersionId;
    await this.drive.approvalVersion(actor, projectId, fileId, fileVersionId);
    if (dto.approverIds) await this.assertApprovers(projectId, dto.approverIds);
    await this.prisma.$transaction(async (tx) => {
      await tx.approvalDocument.update({ where: { id: documentId }, data: { title: dto.title === undefined ? undefined : this.security.plainText(dto.title, "결재 제목"), content: dto.content === undefined ? undefined : this.security.plainText(dto.content, "결재 내용"), fileId, fileVersionId } });
      if (dto.approverIds) { await tx.approvalRouteMember.deleteMany({ where: { documentId } }); await tx.approvalRouteMember.createMany({ data: dto.approverIds.map((approverId, index) => ({ documentId, approverId, sequence: index + 1 })) }); }
      await tx.approvalAction.create({ data: { documentId, actorId: actor.id, type: "UPDATED", fromStatus: current.status, toStatus: current.status } });
      await this.audit(tx, actor.id, projectId, documentId, "APPROVAL_UPDATED", { status: current.status });
    });
    return this.detail(actor, projectId, documentId);
  }

  async submit(actor: Actor, projectId: string, documentId: string) {
    await this.collaboration.authorizeProject(actor, projectId, true);
    const document = await this.requireEditable(actor, projectId, documentId);
    const { file, version } = await this.drive.approvalVersion(actor, projectId, document.fileId, document.fileVersionId);
    const route = await this.prisma.approvalRouteMember.findMany({ where: { documentId }, orderBy: { sequence: "asc" } });
    if (!route.length || !version.sha256) throw new ConflictException("문서 버전과 결재선을 확인해 주세요.");
    const revisionNumber = document.currentRevision + 1;
    await this.prisma.$transaction(async (tx) => {
      const revision = await tx.approvalRevision.create({ data: { documentId, projectId, fileVersionId: version.id, revision: revisionNumber, titleSnapshot: document.title, contentSnapshot: document.content, fileNameSnapshot: file.name, fileVersion: version.version, fileSha256: version.sha256!, storageKeySnapshot: version.storageKey, mimeTypeSnapshot: version.mimeType, sizeSnapshot: version.size, steps: { create: route.map((item, index) => ({ approverId: item.approverId, sequence: item.sequence, status: index === 0 ? "ACTIVE" : "PENDING" })) } } });
      await tx.approvalDocument.update({ where: { id: documentId }, data: { status: "IN_REVIEW", currentRevision: revisionNumber, submittedAt: new Date(), approvedAt: null, rejectedAt: null } });
      await tx.approvalAction.create({ data: { documentId, revisionId: revision.id, actorId: actor.id, type: document.status === "DRAFT" ? "SUBMITTED" : "RESUBMITTED", fromStatus: document.status, toStatus: "IN_REVIEW" } });
      await tx.approvalNotification.create({ data: { documentId, projectId, userId: route[0]!.approverId, type: "APPROVAL_REQUESTED", message: `결재 요청: ${document.title}` } });
      await this.audit(tx, actor.id, projectId, documentId, "APPROVAL_SUBMITTED", { from: document.status, to: "IN_REVIEW", revision: revisionNumber, fileVersionId: version.id, sha256: version.sha256 });
    });
    return this.detail(actor, projectId, documentId);
  }

  async approve(actor: Actor, projectId: string, documentId: string, comment?: string) { return this.decide(actor, projectId, documentId, "APPROVED", comment); }
  async reject(actor: Actor, projectId: string, documentId: string, comment: string) { return this.decide(actor, projectId, documentId, "REJECTED", this.security.plainText(comment, "반려 의견")); }

  async withdraw(actor: Actor, projectId: string, documentId: string) {
    await this.collaboration.authorizeProject(actor, projectId, true);
    const document = await this.prisma.approvalDocument.findFirst({ where: { id: documentId, projectId, status: "IN_REVIEW" } });
    if (!document) throw new NotFoundException("회수할 결재 문서를 찾을 수 없습니다.");
    if (document.createdById !== actor.id) throw new ForbiddenException("기안자만 결재 문서를 회수할 수 있습니다.");
    const revision = await this.prisma.approvalRevision.findUnique({ where: { documentId_revision: { documentId, revision: document.currentRevision } }, include: { steps: true } });
    if (!revision || revision.steps.some((step) => step.status === "APPROVED" || step.status === "REJECTED")) throw new ConflictException("첫 결재 처리 이후에는 회수할 수 없습니다.");
    await this.prisma.$transaction(async (tx) => {
      await tx.approvalStep.updateMany({ where: { revisionId: revision.id, status: { in: ["ACTIVE", "PENDING"] } }, data: { status: "PENDING" } });
      await tx.approvalDocument.update({ where: { id: documentId }, data: { status: "WITHDRAWN" } });
      await tx.approvalAction.create({ data: { documentId, revisionId: revision.id, actorId: actor.id, type: "WITHDRAWN", fromStatus: "IN_REVIEW", toStatus: "WITHDRAWN" } });
      await this.audit(tx, actor.id, projectId, documentId, "APPROVAL_WITHDRAWN", { from: "IN_REVIEW", to: "WITHDRAWN", revision: document.currentRevision });
    });
    return this.detail(actor, projectId, documentId);
  }

  async notifications(actor: Actor, projectId: string) {
    await this.collaboration.authorizeProject(actor, projectId, false);
    return this.prisma.approvalNotification.findMany({ where: { projectId, userId: actor.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  async readNotification(actor: Actor, projectId: string, notificationId: string) {
    await this.collaboration.authorizeProject(actor, projectId, false);
    const item = await this.prisma.approvalNotification.findFirst({ where: { id: notificationId, projectId, userId: actor.id } });
    if (!item) throw new NotFoundException("결재 알림을 찾을 수 없습니다.");
    return this.prisma.approvalNotification.update({ where: { id: item.id }, data: { readAt: new Date() } });
  }

  private async decide(actor: Actor, projectId: string, documentId: string, decision: "APPROVED" | "REJECTED", comment?: string) {
    await this.collaboration.authorizeProject(actor, projectId, true);
    const document = await this.prisma.approvalDocument.findFirst({ where: { id: documentId, projectId, status: "IN_REVIEW" } });
    if (!document) throw new NotFoundException("처리할 결재 문서를 찾을 수 없습니다.");
    const revision = await this.prisma.approvalRevision.findUnique({ where: { documentId_revision: { documentId, revision: document.currentRevision } }, include: { steps: { orderBy: { sequence: "asc" } } } });
    const active = revision?.steps.find((step) => step.status === "ACTIVE");
    if (!revision || !active || active.approverId !== actor.id) throw new ForbiddenException("현재 순번의 지정 결재자만 처리할 수 있습니다.");
    const safeComment = comment ? this.security.plainText(comment, "결재 의견") : undefined;
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.approvalStep.updateMany({ where: { id: active.id, status: "ACTIVE", approverId: actor.id }, data: { status: decision, comment: safeComment, decidedAt: new Date() } });
      if (claimed.count !== 1) throw new ConflictException("이미 처리된 결재 단계입니다.");
      const next = decision === "APPROVED" ? revision.steps.find((step) => step.sequence > active.sequence && step.status === "PENDING") : undefined;
      const finalStatus = decision === "REJECTED" ? "REJECTED" : next ? "IN_REVIEW" : "APPROVED";
      if (next) await tx.approvalStep.update({ where: { id: next.id }, data: { status: "ACTIVE" } });
      await tx.approvalDocument.update({ where: { id: documentId }, data: { status: finalStatus, approvedAt: finalStatus === "APPROVED" ? new Date() : null, rejectedAt: finalStatus === "REJECTED" ? new Date() : null } });
      await tx.approvalAction.create({ data: { documentId, revisionId: revision.id, actorId: actor.id, type: decision, fromStatus: "IN_REVIEW", toStatus: finalStatus, comment: safeComment } });
      const recipientId = next?.approverId ?? document.createdById;
      await tx.approvalNotification.create({ data: { documentId, projectId, userId: recipientId, type: next ? "APPROVAL_REQUESTED" : `APPROVAL_${finalStatus}`, message: next ? `다음 순번 결재 요청: ${document.title}` : `${document.title} 문서가 ${finalStatus === "APPROVED" ? "승인 완료" : "반려"}되었습니다.` } });
      await this.audit(tx, actor.id, projectId, documentId, `APPROVAL_${decision}`, { from: "IN_REVIEW", to: finalStatus, revision: document.currentRevision, step: active.sequence });
    });
    return this.detail(actor, projectId, documentId);
  }

  private async requireEditable(actor: Actor, projectId: string, documentId: string) {
    const document = await this.prisma.approvalDocument.findFirst({ where: { id: documentId, projectId } });
    if (!document) throw new NotFoundException("결재 문서를 찾을 수 없습니다.");
    if (document.createdById !== actor.id || !["DRAFT", "REJECTED", "WITHDRAWN"].includes(document.status)) throw new ForbiddenException("작성자의 기안·반려·회수 문서만 수정할 수 있습니다.");
    return document;
  }

  private async assertApprovers(projectId: string, approverIds: string[]) {
    const unique = [...new Set(approverIds)];
    const count = await this.prisma.projectMembership.count({ where: { projectId, userId: { in: unique }, status: "ACTIVE", user: { isActive: true } } });
    if (count !== unique.length) throw new NotFoundException("같은 프로젝트의 활성 참여자만 결재자로 지정할 수 있습니다.");
  }

  private audit(tx: Prisma.TransactionClient, actorId: string, projectId: string, resourceId: string, action: string, summary: Prisma.InputJsonObject) {
    return tx.auditLog.create({ data: { actorId, projectId, resourceId, resourceType: "ApprovalDocument", action, summary } });
  }

  private serialize<T extends { fileVersion: { size: bigint }; revisions: Array<{ sizeSnapshot: bigint }> }>(document: T) {
    return { ...document, fileVersion: { ...document.fileVersion, size: document.fileVersion.size.toString() }, revisions: document.revisions.map((revision) => ({ ...revision, sizeSnapshot: revision.sizeSnapshot.toString() })) };
  }
}
