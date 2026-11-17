import { randomUUID } from "node:crypto";

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type CalendarEvent, type ProjectRole } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { InputSecurityService } from "../feed/input-security.service";
import { S3_CLIENT } from "../infrastructure/infrastructure.constants";
import type { Actor, ProjectMemberView } from "../projects/collaboration.types";
import { CollaborationService } from "../projects/collaboration.service";
import type {
  CalendarFilterDto,
  CreateCalendarEventDto,
  PrepareCalendarAttachmentDto,
  UpdateCalendarEventDto,
} from "./calendar.dto";

const MANAGER_ROLES = new Set<ProjectRole>([
  "CLIENT_ADMIN",
  "PROJECT_ADMIN",
  "PROJECT_PM",
  "PROJECT_MANAGER",
]);
const ATTACHMENT_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "dwg",
  "ifc",
  "zip",
]);

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collaboration: CollaborationService,
    private readonly security: InputSecurityService,
    private readonly config: ConfigService,
    @Inject(S3_CLIENT) private readonly s3: S3Client,
  ) {}

  async list(actor: Actor, projectId: string, dto: CalendarFilterDto) {
    await this.collaboration.authorizeProject(actor, projectId, false);
    const from = new Date(dto.from);
    const to = new Date(dto.to);
    if (from >= to)
      throw new BadRequestException("조회 종료일은 시작일보다 뒤여야 합니다.");
    const groups = await this.collaboration.listGroups(actor, projectId);
    const where: Prisma.CalendarEventWhereInput = {
      projectId,
      archivedAt: null,
      startsAt: { lt: to },
      endsAt: { gte: from },
      kind: dto.kind,
      OR: [
        { groupId: null },
        { groupId: { in: groups.map((group) => group.id) } },
      ],
      AND: dto.query
        ? {
            OR: [
              { title: { contains: dto.query, mode: "insensitive" } },
              { description: { contains: dto.query, mode: "insensitive" } },
              { milestoneName: { contains: dto.query, mode: "insensitive" } },
            ],
          }
        : undefined,
    };
    const items = await this.prisma.calendarEvent.findMany({
      where,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      include: this.eventInclude(),
    });
    return { items: items.map((item) => this.serializeEvent(item)) };
  }

  async context(actor: Actor, projectId: string) {
    await this.collaboration.authorizeProject(actor, projectId, false);
    const groups = await this.collaboration.listGroups(actor, projectId);
    const memberships = await this.prisma.projectMembership.findMany({
      where: { projectId, status: "ACTIVE", user: { isActive: true } },
      select: {
        role: true,
        user: { select: { id: true, name: true } },
        organization: { select: { name: true } },
      },
      orderBy: { user: { name: "asc" } },
    });
    const issues = await this.prisma.feedPost.findMany({
      where: {
        projectId,
        groupId: { in: groups.map((group) => group.id) },
        archivedAt: null,
      },
      select: { id: true, title: true, groupId: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return {
      groups: groups.map(({ id, name }) => ({ id, name })),
      members: memberships,
      issues,
    };
  }

  async get(actor: Actor, projectId: string, eventId: string) {
    const access = await this.collaboration.authorizeProject(
      actor,
      projectId,
      false,
    );
    const event = await this.requireEvent(projectId, eventId);
    await this.assertEventAccess(
      actor,
      projectId,
      event,
      access.membership,
      false,
    );
    return this.prisma.calendarEvent
      .findUnique({ where: { id: eventId }, include: this.eventInclude() })
      .then((item) => this.serializeEvent(item!));
  }

  async create(actor: Actor, projectId: string, dto: CreateCalendarEventDto) {
    await this.collaboration.authorizeProject(actor, projectId, true);
    await this.validateReferences(
      actor,
      projectId,
      dto.groupId,
      dto.issueId,
      dto.assigneeId,
      dto.participantIds,
      true,
    );
    const dates = this.dates(dto.startsAt, dto.endsAt);
    const title = this.security.plainText(dto.title, "일정 제목");
    const description = dto.description
      ? this.security.plainText(dto.description, "일정 설명")
      : undefined;
    const milestoneName = this.milestoneName(
      dto.kind,
      dto.milestoneName,
      title,
    );
    const event = await this.prisma.calendarEvent.create({
      data: {
        projectId,
        groupId: dto.groupId,
        createdById: actor.id,
        assigneeId: dto.assigneeId,
        issueId: dto.issueId,
        kind: dto.kind,
        title,
        description,
        ...dates,
        allDay: dto.allDay,
        milestoneName,
        reminderMinutes: dto.reminderMinutes,
        participants: dto.participantIds?.length
          ? {
              create: [...new Set(dto.participantIds)].map((userId) => ({
                userId,
              })),
            }
          : undefined,
      },
      include: this.eventInclude(),
    });
    await this.replaceReminders(
      event.id,
      dates.startsAt,
      dto.reminderMinutes,
      dto.assigneeId,
      dto.participantIds,
    );
    return this.serializeEvent(event);
  }

  async update(
    actor: Actor,
    projectId: string,
    eventId: string,
    dto: UpdateCalendarEventDto,
  ) {
    const access = await this.collaboration.authorizeProject(
      actor,
      projectId,
      true,
    );
    const current = await this.requireEvent(projectId, eventId);
    const participantIds =
      dto.participantIds ??
      (
        await this.prisma.calendarEventParticipant.findMany({
          where: { eventId },
          select: { userId: true },
        })
      ).map((item) => item.userId);
    const groupId = Object.prototype.hasOwnProperty.call(dto, "groupId")
      ? (dto.groupId ?? undefined)
      : (current.groupId ?? undefined);
    await this.assertCanManage(actor, access.membership, current, projectId);
    await this.validateReferences(
      actor,
      projectId,
      groupId,
      dto.issueId === null
        ? undefined
        : (dto.issueId ?? current.issueId ?? undefined),
      dto.assigneeId === null
        ? undefined
        : (dto.assigneeId ?? current.assigneeId ?? undefined),
      participantIds,
      true,
    );
    const dates = this.dates(
      dto.startsAt ?? current.startsAt.toISOString(),
      dto.endsAt ?? current.endsAt.toISOString(),
    );
    const kind = dto.kind ?? current.kind;
    const title =
      dto.title === undefined
        ? current.title
        : this.security.plainText(dto.title, "일정 제목");
    const milestoneName = this.milestoneName(
      kind,
      dto.milestoneName ?? current.milestoneName ?? undefined,
      title,
    );
    const groupSpecified = Object.prototype.hasOwnProperty.call(dto, "groupId");
    const assigneeSpecified = Object.prototype.hasOwnProperty.call(
      dto,
      "assigneeId",
    );
    const issueSpecified = Object.prototype.hasOwnProperty.call(dto, "issueId");
    const updated = await this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        kind,
        title,
        description:
          dto.description === undefined
            ? undefined
            : dto.description
              ? this.security.plainText(dto.description, "일정 설명")
              : null,
        ...dates,
        allDay: dto.allDay,
        milestoneName,
        reminderMinutes: dto.reminderMinutes,
        groupId: groupSpecified ? dto.groupId : undefined,
        assigneeId: assigneeSpecified ? dto.assigneeId : undefined,
        issueId: issueSpecified ? dto.issueId : undefined,
        participants:
          dto.participantIds === undefined
            ? undefined
            : {
                deleteMany: {},
                create: [...new Set(dto.participantIds)].map((userId) => ({
                  userId,
                })),
              },
      },
      include: this.eventInclude(),
    });
    await this.replaceReminders(
      eventId,
      dates.startsAt,
      dto.reminderMinutes ?? current.reminderMinutes,
      assigneeSpecified
        ? (dto.assigneeId ?? undefined)
        : (current.assigneeId ?? undefined),
      participantIds,
    );
    return this.serializeEvent(updated);
  }

  async archive(actor: Actor, projectId: string, eventId: string) {
    const access = await this.collaboration.authorizeProject(
      actor,
      projectId,
      true,
    );
    const event = await this.requireEvent(projectId, eventId);
    await this.assertCanManage(actor, access.membership, event, projectId);
    await this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: { archivedAt: new Date() },
    });
    return { archived: true };
  }

  async listReminders(actor: Actor, projectId: string) {
    await this.collaboration.authorizeProject(actor, projectId, false);
    const groups = await this.collaboration.listGroups(actor, projectId);
    return this.prisma.calendarReminder.findMany({
      where: {
        userId: actor.id,
        readAt: null,
        scheduledAt: { lte: new Date() },
        event: {
          projectId,
          archivedAt: null,
          OR: [
            { groupId: null },
            { groupId: { in: groups.map((group) => group.id) } },
          ],
        },
      },
      orderBy: { scheduledAt: "desc" },
      take: 50,
      include: {
        event: {
          select: { id: true, title: true, startsAt: true, kind: true },
        },
      },
    });
  }

  async readReminder(actor: Actor, projectId: string, reminderId: string) {
    await this.collaboration.authorizeProject(actor, projectId, false);
    const reminder = await this.prisma.calendarReminder.findFirst({
      where: { id: reminderId, userId: actor.id, event: { projectId } },
    });
    if (!reminder) throw new NotFoundException("일정 알림을 찾을 수 없습니다.");
    return this.prisma.calendarReminder.update({
      where: { id: reminderId },
      data: { readAt: new Date() },
    });
  }

  async prepareAttachment(
    actor: Actor,
    projectId: string,
    eventId: string,
    dto: PrepareCalendarAttachmentDto,
  ) {
    const access = await this.collaboration.authorizeProject(
      actor,
      projectId,
      true,
    );
    const event = await this.requireEvent(projectId, eventId);
    await this.assertEventAccess(
      actor,
      projectId,
      event,
      access.membership,
      true,
    );
    if (!dto.mimeType || /[\r\n]/u.test(dto.mimeType)) {
      throw new BadRequestException("올바른 파일 형식이 아닙니다.");
    }
    const originalName = this.security.fileName(dto.originalName);
    const extension = originalName.split(".").pop()?.toLowerCase() ?? "";
    if (!ATTACHMENT_EXTENSIONS.has(extension))
      throw new BadRequestException("허용되지 않는 첨부파일 형식입니다.");
    const storageKey = `projects/${projectId}/calendar/${eventId}/${randomUUID()}`;
    const attachment = await this.prisma.calendarEventAttachment.create({
      data: {
        projectId,
        eventId,
        uploadedById: actor.id,
        originalName,
        storageKey,
        mimeType: dto.mimeType || "application/octet-stream",
        size: BigInt(dto.size),
      },
    });
    const url = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: storageKey,
        ContentType: attachment.mimeType,
        ContentLength: dto.size,
      }),
      { expiresIn: 600 },
    );
    return {
      attachment: this.serializeAttachment(attachment),
      upload: {
        url,
        method: "PUT",
        headers: { "content-type": attachment.mimeType },
        expiresInSeconds: 600,
      },
    };
  }

  async completeAttachment(
    actor: Actor,
    projectId: string,
    eventId: string,
    attachmentId: string,
  ) {
    const access = await this.collaboration.authorizeProject(
      actor,
      projectId,
      true,
    );
    const event = await this.requireEvent(projectId, eventId);
    await this.assertEventAccess(
      actor,
      projectId,
      event,
      access.membership,
      true,
    );
    const attachment = await this.prisma.calendarEventAttachment.findFirst({
      where: {
        id: attachmentId,
        projectId,
        eventId,
        uploadedById: actor.id,
        status: "PREPARED",
      },
    });
    if (!attachment)
      throw new NotFoundException(
        "업로드 대기 중인 첨부파일을 찾을 수 없습니다.",
      );
    try {
      const object = await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucket(),
          Key: attachment.storageKey,
        }),
      );
      if (object.ContentLength !== Number(attachment.size)) throw new Error();
    } catch {
      await this.prisma.calendarEventAttachment.update({
        where: { id: attachment.id },
        data: { status: "FAILED" },
      });
      throw new BadRequestException("업로드된 첨부파일을 확인할 수 없습니다.");
    }
    return this.serializeAttachment(
      await this.prisma.calendarEventAttachment.update({
        where: { id: attachment.id },
        data: { status: "AVAILABLE" },
      }),
    );
  }

  async downloadAttachment(
    actor: Actor,
    projectId: string,
    eventId: string,
    attachmentId: string,
  ) {
    const access = await this.collaboration.authorizeProject(
      actor,
      projectId,
      false,
    );
    const event = await this.requireEvent(projectId, eventId);
    await this.assertEventAccess(
      actor,
      projectId,
      event,
      access.membership,
      false,
    );
    const attachment = await this.prisma.calendarEventAttachment.findFirst({
      where: { id: attachmentId, projectId, eventId, status: "AVAILABLE" },
    });
    if (!attachment)
      throw new NotFoundException("첨부파일을 찾을 수 없습니다.");
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket(),
        Key: attachment.storageKey,
        ResponseContentType: attachment.mimeType,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
      }),
      { expiresIn: 300 },
    );
    return { url, expiresInSeconds: 300 };
  }

  private async validateReferences(
    actor: Actor,
    projectId: string,
    groupId?: string,
    issueId?: string,
    assigneeId?: string,
    participantIds?: string[],
    write = false,
  ) {
    if (groupId)
      await this.collaboration.authorizeGroup(actor, projectId, groupId, write);
    const userIds = [
      ...new Set(
        [assigneeId, ...(participantIds ?? [])].filter((id): id is string =>
          Boolean(id),
        ),
      ),
    ];
    if (userIds.length) {
      const count = await this.prisma.projectMembership.count({
        where: {
          projectId,
          userId: { in: userIds },
          status: "ACTIVE",
          user: { isActive: true },
        },
      });
      if (count !== userIds.length)
        throw new BadRequestException(
          "담당자와 참여자는 이 프로젝트의 활성 참여자여야 합니다.",
        );
    }
    if (issueId) {
      const issue = await this.prisma.feedPost.findFirst({
        where: { id: issueId, projectId, archivedAt: null },
        select: { groupId: true },
      });
      if (!issue)
        throw new BadRequestException(
          "같은 프로젝트의 이슈만 연결할 수 있습니다.",
        );
      await this.collaboration.authorizeGroup(
        actor,
        projectId,
        issue.groupId,
        false,
      );
      if (!groupId || issue.groupId !== groupId)
        throw new BadRequestException(
          "관련 이슈와 동일한 협업 그룹을 일정에 지정해 주세요.",
        );
    }
  }

  private async requireEvent(projectId: string, eventId: string) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, projectId, archivedAt: null },
    });
    if (!event) throw new NotFoundException("일정을 찾을 수 없습니다.");
    return event;
  }
  private async assertEventAccess(
    actor: Actor,
    projectId: string,
    event: CalendarEvent,
    membership: ProjectMemberView | null,
    write: boolean,
  ) {
    if (event.groupId)
      await this.collaboration.authorizeGroup(
        actor,
        projectId,
        event.groupId,
        write,
      );
    else if (
      write &&
      membership &&
      (membership.role === "READ_ONLY" || membership.role === "VIEWER")
    )
      throw new ForbiddenException("일정을 변경할 권한이 없습니다.");
  }
  private async assertCanManage(
    actor: Actor,
    membership: ProjectMemberView | null,
    event: CalendarEvent,
    projectId: string,
  ) {
    await this.assertEventAccess(actor, projectId, event, membership, true);
    if (
      actor.platformRole === "PLATFORM_ADMIN" ||
      event.createdById === actor.id ||
      (membership && MANAGER_ROLES.has(membership.role))
    )
      return;
    throw new ForbiddenException(
      "이 일정을 수정하거나 삭제할 권한이 없습니다.",
    );
  }
  private dates(startsAtValue: string, endsAtValue: string) {
    const startsAt = new Date(startsAtValue);
    const endsAt = new Date(endsAtValue);
    if (startsAt >= endsAt)
      throw new BadRequestException("일정 종료는 시작보다 뒤여야 합니다.");
    return { startsAt, endsAt };
  }
  private milestoneName(
    kind: string,
    value: string | undefined,
    title: string,
  ) {
    if (kind !== "MILESTONE") return null;
    return this.security.plainText(value ?? title, "마일스톤 이름");
  }
  private async replaceReminders(
    eventId: string,
    startsAt: Date,
    minutes: number,
    assigneeId?: string,
    participantIds?: string[],
  ) {
    const userIds = [
      ...new Set(
        [assigneeId, ...(participantIds ?? [])].filter((id): id is string =>
          Boolean(id),
        ),
      ),
    ];
    await this.prisma.$transaction([
      this.prisma.calendarReminder.deleteMany({ where: { eventId } }),
      ...(userIds.length
        ? [
            this.prisma.calendarReminder.createMany({
              data: userIds.map((userId) => ({
                eventId,
                userId,
                scheduledAt: new Date(startsAt.getTime() - minutes * 60000),
              })),
            }),
          ]
        : []),
    ]);
  }
  private eventInclude() {
    return {
      createdBy: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      issue: { select: { id: true, title: true, groupId: true } },
      participants: { include: { user: { select: { id: true, name: true } } } },
      attachments: { where: { status: "AVAILABLE" as const } },
    } satisfies Prisma.CalendarEventInclude;
  }
  private serializeAttachment<
    T extends {
      id: string;
      originalName: string;
      mimeType: string;
      size: bigint;
      status: string;
      createdAt: Date;
    },
  >(item: T) {
    return {
      id: item.id,
      originalName: item.originalName,
      mimeType: item.mimeType,
      size: item.size.toString(),
      status: item.status,
      createdAt: item.createdAt,
    };
  }
  private serializeEvent<
    T extends {
      attachments?: Array<{
        id: string;
        originalName: string;
        mimeType: string;
        size: bigint;
        status: string;
        createdAt: Date;
      }>;
    },
  >(item: T) {
    return {
      ...item,
      attachments: item.attachments?.map((attachment) =>
        this.serializeAttachment(attachment),
      ),
    };
  }
  private bucket() {
    return this.config.getOrThrow<string>("S3_BUCKET");
  }
}
