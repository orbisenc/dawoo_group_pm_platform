import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { DriveService } from "../drive/drive.service";
import { InputSecurityService } from "../feed/input-security.service";
import type { Actor } from "../projects/collaboration.types";
import { CollaborationService } from "../projects/collaboration.service";
import { RequestContextService } from "../observability/request-context.service";
import type { ApprovalListDto, CreateApprovalDto, CreateApprovalRouteTemplateDto, UpdateApprovalDto, UpdateApprovalRouteTemplateDto } from "./approval.dto";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly collaboration: CollaborationService,
    private readonly drive: DriveService,
    private readonly security: InputSecurityService,
    private readonly requestContext: RequestContextService,
  ) {}

  async list(actor: Actor, projectId: string, dto: ApprovalListDto) {
    const projectMember = await this.hasProjectAccess(actor, projectId);
    const where: Prisma.ApprovalDocumentWhereInput = { projectId };
    if (!projectMember) {
      where.status = "IN_REVIEW";
      where.revisions = { some: { steps: { some: { approverId: actor.id } } } };
    } else if (dto.scope === "mine") where.createdById = actor.id;
    else if (dto.scope === "pending") where.revisions = { some: { steps: { some: { approverId: actor.id, status: "ACTIVE" } } } };
    const items = await this.prisma.approvalDocument.findMany({ where, orderBy: { updatedAt: "desc" }, include: { createdBy: { select: { id: true, name: true } }, file: { select: { id: true, name: true } }, revisions: { orderBy: { revision: "desc" }, take: 1, include: { steps: { orderBy: { sequence: "asc" }, include: { approver: { select: { id: true, name: true } } } } } } } });
    return { items: projectMember ? items : items.filter((item) => item.revisions[0]?.steps.some((step) => step.approver.id === actor.id)) };
  }

  async context(actor: Actor, projectId: string) {
    await this.collaboration.authorizeProject(actor, projectId, false);
    const [files, approvedUsers, memberships] = await Promise.all([
      this.drive.listApprovalFiles(actor, projectId),
      this.prisma.user.findMany({
        where: { approvalStatus: "APPROVED", isActive: true },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true },
      }),
      this.prisma.projectMembership.findMany({
        where: { projectId, status: "ACTIVE" },
        select: { userId: true, role: true },
      }),
    ]);
    const roles = new Map(memberships.map((membership) => [membership.userId, membership.role]));
    return {
      files,
      members: approvedUsers.map((user) => ({
        user,
        role: roles.get(user.id) ?? "APPROVED_USER",
        projectMember: roles.has(user.id),
      })),
    };
  }

  async detail(actor: Actor, projectId: string, documentId: string) {
    const projectMember = await this.hasProjectAccess(actor, projectId);
    const document = await this.prisma.approvalDocument.findFirst({ where: { id: documentId, projectId }, include: detailInclude });
    if (!document) throw new NotFoundException("결재 문서를 찾을 수 없습니다.");
    const currentRevision = document.revisions.find((revision) => revision.revision === document.currentRevision);
    if (!projectMember && !currentRevision?.steps.some((step) => step.approver.id === actor.id)) {
      throw new NotFoundException("결재 문서를 찾을 수 없습니다.");
    }
    return this.serialize(document);
  }

  async create(actor: Actor, projectId: string, dto: CreateApprovalDto) {
    await this.collaboration.authorizeProject(actor, projectId, true);
    const attachment = await this.resolveAttachment(actor, projectId, dto.fileId, dto.fileVersionId);
    await this.assertApprovers(projectId, dto.approverIds);
    const title = this.security.plainText(dto.title, "결재 제목");
    const content = this.security.plainText(dto.content, "결재 내용");
    const document = await this.prisma.$transaction(async (tx) => {
      const created = await tx.approvalDocument.create({ data: { projectId, createdById: actor.id, fileId: attachment?.file.id, fileVersionId: attachment?.version.id, title, content, routeMembers: { create: dto.approverIds.map((approverId, index) => ({ approverId, sequence: index + 1 })) } } });
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
    await this.resolveAttachment(actor, projectId, fileId ?? undefined, fileVersionId ?? undefined);
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
    const attachment = await this.resolveAttachment(actor, projectId, document.fileId ?? undefined, document.fileVersionId ?? undefined);
    const route = await this.prisma.approvalRouteMember.findMany({ where: { documentId }, orderBy: { sequence: "asc" } });
    if (!route.length) throw new ConflictException("결재선을 확인해 주세요.");
    if (attachment && !attachment.version.sha256) throw new ConflictException("첨부파일의 해시가 준비되지 않았습니다.");
    const revisionNumber = document.currentRevision + 1;
    await this.prisma.$transaction(async (tx) => {
      const revision = await tx.approvalRevision.create({ data: { documentId, projectId, fileVersionId: attachment?.version.id, revision: revisionNumber, titleSnapshot: document.title, contentSnapshot: document.content, fileNameSnapshot: attachment?.file.name, fileVersion: attachment?.version.version, fileSha256: attachment?.version.sha256, storageKeySnapshot: attachment?.version.storageKey, mimeTypeSnapshot: attachment?.version.mimeType, sizeSnapshot: attachment?.version.size, steps: { create: route.map((item, index) => ({ approverId: item.approverId, sequence: item.sequence, status: index === 0 ? "ACTIVE" : "PENDING" })) } } });
      await tx.approvalDocument.update({ where: { id: documentId }, data: { status: "IN_REVIEW", currentRevision: revisionNumber, submittedAt: new Date(), approvedAt: null, rejectedAt: null } });
      await tx.approvalAction.create({ data: { documentId, revisionId: revision.id, actorId: actor.id, type: document.status === "DRAFT" ? "SUBMITTED" : "RESUBMITTED", fromStatus: document.status, toStatus: "IN_REVIEW" } });
      await tx.approvalNotification.create({ data: { documentId, projectId, userId: route[0]!.approverId, type: "APPROVAL_REQUESTED", message: `결재 요청: ${document.title}` } });
      await this.audit(tx, actor.id, projectId, documentId, "APPROVAL_SUBMITTED", { from: document.status, to: "IN_REVIEW", revision: revisionNumber, fileVersionId: attachment?.version.id ?? null, sha256: attachment?.version.sha256 ?? null });
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

  async listRouteTemplates(actor: Actor, projectId: string) {
    await this.collaboration.authorizeProject(actor, projectId, false);
    return this.prisma.approvalRouteTemplate.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        members: { orderBy: { sequence: "asc" }, include: { approver: { select: { id: true, name: true } } } },
      },
    });
  }

  async createRouteTemplate(actor: Actor, projectId: string, dto: CreateApprovalRouteTemplateDto) {
    await this.collaboration.authorizeProject(actor, projectId, true);
    await this.assertApprovers(projectId, dto.approverIds);
    const name = this.security.plainText(dto.name, "결재선 이름");
    const description = dto.description ? this.security.plainText(dto.description, "결재선 설명") : undefined;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const template = await tx.approvalRouteTemplate.create({
          data: {
            projectId,
            createdById: actor.id,
            name,
            description,
            members: { create: dto.approverIds.map((approverId, index) => ({ approverId, sequence: index + 1 })) },
          },
          include: {
            createdBy: { select: { id: true, name: true } },
            members: { orderBy: { sequence: "asc" }, include: { approver: { select: { id: true, name: true } } } },
          },
        });
        await this.audit(tx, actor.id, projectId, template.id, "APPROVAL_ROUTE_TEMPLATE_CREATED", { name }, "ApprovalRouteTemplate");
        return template;
      });
    } catch (reason) {
      if (reason instanceof Prisma.PrismaClientKnownRequestError && reason.code === "P2002") throw new ConflictException("같은 이름의 결재선이 이미 있습니다.");
      throw reason;
    }
  }

  async updateRouteTemplate(actor: Actor, projectId: string, templateId: string, dto: UpdateApprovalRouteTemplateDto) {
    await this.collaboration.authorizeProject(actor, projectId, true);
    const current = await this.prisma.approvalRouteTemplate.findFirst({ where: { id: templateId, projectId } });
    if (!current) throw new NotFoundException("결재선 템플릿을 찾을 수 없습니다.");
    if (current.createdById !== actor.id && actor.platformRole !== "PLATFORM_ADMIN") throw new ForbiddenException("결재선 작성자만 템플릿을 수정할 수 있습니다.");
    if (dto.approverIds) await this.assertApprovers(projectId, dto.approverIds);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.approvalRouteTemplate.update({
          where: { id: templateId },
          data: {
            name: dto.name === undefined ? undefined : this.security.plainText(dto.name, "결재선 이름"),
            description: dto.description === undefined ? undefined : this.security.plainText(dto.description, "결재선 설명"),
          },
        });
        if (dto.approverIds) {
          await tx.approvalRouteTemplateMember.deleteMany({ where: { templateId } });
          await tx.approvalRouteTemplateMember.createMany({ data: dto.approverIds.map((approverId, index) => ({ templateId, approverId, sequence: index + 1 })) });
        }
        await this.audit(tx, actor.id, projectId, templateId, "APPROVAL_ROUTE_TEMPLATE_UPDATED", { name: dto.name ?? current.name }, "ApprovalRouteTemplate");
        return tx.approvalRouteTemplate.findUniqueOrThrow({
          where: { id: templateId },
          include: {
            createdBy: { select: { id: true, name: true } },
            members: { orderBy: { sequence: "asc" }, include: { approver: { select: { id: true, name: true } } } },
          },
        });
      });
    } catch (reason) {
      if (reason instanceof Prisma.PrismaClientKnownRequestError && reason.code === "P2002") throw new ConflictException("같은 이름의 결재선이 이미 있습니다.");
      throw reason;
    }
  }

  async deleteRouteTemplate(actor: Actor, projectId: string, templateId: string) {
    await this.collaboration.authorizeProject(actor, projectId, true);
    const current = await this.prisma.approvalRouteTemplate.findFirst({ where: { id: templateId, projectId } });
    if (!current) throw new NotFoundException("결재선 템플릿을 찾을 수 없습니다.");
    if (current.createdById !== actor.id && actor.platformRole !== "PLATFORM_ADMIN") throw new ForbiddenException("결재선 작성자만 템플릿을 삭제할 수 있습니다.");
    await this.prisma.$transaction(async (tx) => {
      await this.audit(tx, actor.id, projectId, templateId, "APPROVAL_ROUTE_TEMPLATE_DELETED", { name: current.name }, "ApprovalRouteTemplate");
      await tx.approvalRouteTemplate.delete({ where: { id: templateId } });
    });
    return { id: templateId };
  }

  async notifications(actor: Actor, projectId: string) {
    return this.prisma.approvalNotification.findMany({ where: { projectId, userId: actor.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  async readNotification(actor: Actor, projectId: string, notificationId: string) {
    const item = await this.prisma.approvalNotification.findFirst({ where: { id: notificationId, projectId, userId: actor.id } });
    if (!item) throw new NotFoundException("결재 알림을 찾을 수 없습니다.");
    return this.prisma.approvalNotification.update({ where: { id: item.id }, data: { readAt: new Date() } });
  }

  private async decide(actor: Actor, projectId: string, documentId: string, decision: "APPROVED" | "REJECTED", comment?: string) {
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

  private async assertApprovers(_projectId: string, approverIds: string[]) {
    const unique = [...new Set(approverIds)];
    const count = await this.prisma.user.count({ where: { id: { in: unique }, approvalStatus: "APPROVED", isActive: true } });
    if (count !== unique.length) throw new NotFoundException("가입 승인이 완료된 활성 회원만 결재자로 지정할 수 있습니다.");
  }

  private async hasProjectAccess(actor: Actor, projectId: string) {
    try {
      await this.collaboration.authorizeProject(actor, projectId, false);
      return true;
    } catch (reason) {
      if (reason instanceof ForbiddenException || reason instanceof NotFoundException) return false;
      throw reason;
    }
  }

  private async resolveAttachment(actor: Actor, projectId: string, fileId?: string, fileVersionId?: string) {
    if (!fileId && !fileVersionId) return null;
    if (!fileId || !fileVersionId) throw new ConflictException("첨부파일과 파일 버전을 함께 선택해 주세요.");
    return this.drive.approvalVersion(actor, projectId, fileId, fileVersionId);
  }

  private audit(tx: Prisma.TransactionClient, actorId: string, projectId: string, resourceId: string, action: string, summary: Prisma.InputJsonObject, resourceType = "ApprovalDocument") {
    return tx.auditLog.create({ data: { actorId, projectId, resourceId, resourceType, action, requestId: this.requestContext.getRequestId(), summary } });
  }

  private serialize<T extends { fileVersion: { size: bigint } | null; revisions: Array<{ sizeSnapshot: bigint | null }> }>(document: T) {
    return { ...document, fileVersion: document.fileVersion ? { ...document.fileVersion, size: document.fileVersion.size.toString() } : null, revisions: document.revisions.map((revision) => ({ ...revision, sizeSnapshot: revision.sizeSnapshot?.toString() ?? null })) };
  }
}
