import { randomUUID } from "node:crypto";

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type FeedPost } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { S3_CLIENT } from "../infrastructure/infrastructure.constants";
import type { Actor, GroupView, ProjectMemberView } from "../projects/collaboration.types";
import { CollaborationService } from "../projects/collaboration.service";
import type { CreateCommentDto, CreateFeedPostDto, FeedFilterDto, PrepareAttachmentDto, UpdateFeedPostDto } from "./feed.dto";
import { InputSecurityService } from "./input-security.service";
import { RealtimeService } from "../realtime/realtime.service";

const ALLOWED_FILES: Record<string, string[]> = {
  jpg: ["image/jpeg"], jpeg: ["image/jpeg"], png: ["image/png"], webp: ["image/webp"],
  pdf: ["application/pdf"], dwg: ["application/acad", "application/x-acad", "image/vnd.dwg"],
};

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collaboration: CollaborationService,
    private readonly security: InputSecurityService,
    private readonly config: ConfigService,
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    private readonly realtime: RealtimeService,
  ) {}

  async list(actor: Actor, projectId: string, groupId: string, filters: FeedFilterDto) {
    await this.collaboration.authorizeGroup(actor, projectId, groupId, false);
    const where: Prisma.FeedPostWhereInput = {
      projectId, groupId, archivedAt: null,
      type: filters.type,
      status: filters.status,
      priority: filters.priority,
      tags: filters.tag ? { has: filters.tag.toLowerCase() } : undefined,
      OR: filters.query ? [
        { title: { contains: filters.query, mode: "insensitive" } },
        { content: { contains: filters.query, mode: "insensitive" } },
        { tags: { has: filters.query.toLowerCase() } },
      ] : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.feedPost.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: {
          author: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
          attachments: { where: { status: "AVAILABLE" } },
          _count: { select: { comments: { where: { archivedAt: null } } } },
        },
      }),
      this.prisma.feedPost.count({ where }),
    ]);
    return { items: items.map((item) => this.serializePost(item)), total, page: filters.page, pageSize: filters.pageSize };
  }

  async listAssignees(actor: Actor, projectId: string, groupId: string) {
    await this.collaboration.authorizeGroup(actor, projectId, groupId, false);
    return this.prisma.projectMembership.findMany({
      where: {
        projectId, status: "ACTIVE", user: { isActive: true },
        OR: [
          { role: { in: ["CLIENT_ADMIN", "PROJECT_ADMIN", "PROJECT_PM", "PROJECT_MANAGER"] } },
          { groupMemberships: { some: { groupId } } },
        ],
      },
      select: { user: { select: { id: true, name: true } }, organization: { select: { id: true, name: true } }, role: true },
      orderBy: { user: { name: "asc" } },
    });
  }

  async get(actor: Actor, projectId: string, groupId: string, postId: string) {
    await this.collaboration.authorizeGroup(actor, projectId, groupId, false);
    const post = await this.prisma.feedPost.findFirst({
      where: { id: postId, projectId, groupId, archivedAt: null },
      include: {
        author: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        attachments: { where: { status: "AVAILABLE" } },
        comments: {
          where: { archivedAt: null, parentId: null }, orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true } }, replies: { where: { archivedAt: null }, orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true } } } } },
        },
      },
    });
    if (!post) throw new NotFoundException("게시글을 찾을 수 없습니다.");
    return this.serializePost(post);
  }

  async create(actor: Actor, projectId: string, groupId: string, dto: CreateFeedPostDto) {
    await this.collaboration.authorizeGroup(actor, projectId, groupId, true);
    await this.assertAssignee(projectId, groupId, dto.assigneeId);
    const post = await this.prisma.feedPost.create({ data: {
      projectId, groupId, authorId: actor.id, type: dto.type,
      title: this.security.plainText(dto.title, "제목"), content: this.security.plainText(dto.content, "내용"),
      assigneeId: dto.assigneeId, priority: dto.priority, status: dto.status, tags: this.security.tags(dto.tags),
    } });
    if (post.assigneeId && post.assigneeId !== actor.id) await this.realtime.publish({ projectId, groupId, postId: post.id, type: "assignee.assigned", payload: { postId: post.id, title: post.title, assigneeId: post.assigneeId }, recipientIds: [post.assigneeId], notificationMessage: `‘${post.title}’ 이슈의 담당자로 지정되었습니다.` });
    await this.publishMentions(actor, projectId, groupId, post.id, post.title, post.content);
    return post;
  }

  async update(actor: Actor, projectId: string, groupId: string, postId: string, dto: UpdateFeedPostDto) {
    const access = await this.collaboration.authorizeGroup(actor, projectId, groupId, true);
    const post = await this.requirePost(projectId, groupId, postId);
    this.assertCanManagePost(actor, access.membership, access.group, post);
    await this.assertAssignee(projectId, groupId, dto.assigneeId);
    const updated = await this.prisma.feedPost.update({ where: { id: postId }, data: {
      ...dto,
      title: dto.title === undefined ? undefined : this.security.plainText(dto.title, "제목"),
      content: dto.content === undefined ? undefined : this.security.plainText(dto.content, "내용"),
      tags: dto.tags === undefined ? undefined : this.security.tags(dto.tags),
    } });
    if (dto.status && dto.status !== post.status) {
      const recipients = [...new Set([post.authorId, post.assigneeId].filter((id): id is string => Boolean(id) && id !== actor.id))];
      await this.realtime.publish({ projectId, groupId, postId, type: "issue.status.changed", payload: { postId, title: updated.title, previousStatus: post.status, status: updated.status, changedBy: actor.id }, recipientIds: recipients, notificationMessage: `‘${updated.title}’ 상태가 변경되었습니다.` });
    }
    if (dto.assigneeId && dto.assigneeId !== post.assigneeId && dto.assigneeId !== actor.id) await this.realtime.publish({ projectId, groupId, postId, type: "assignee.assigned", payload: { postId, title: updated.title, assigneeId: dto.assigneeId }, recipientIds: [dto.assigneeId], notificationMessage: `‘${updated.title}’ 이슈의 담당자로 지정되었습니다.` });
    if (dto.content) await this.publishMentions(actor, projectId, groupId, postId, updated.title, updated.content);
    return updated;
  }

  async archive(actor: Actor, projectId: string, groupId: string, postId: string) {
    const access = await this.collaboration.authorizeGroup(actor, projectId, groupId, true);
    const post = await this.requirePost(projectId, groupId, postId);
    this.assertCanManagePost(actor, access.membership, access.group, post);
    return this.prisma.feedPost.update({ where: { id: postId }, data: { archivedAt: new Date() } });
  }

  async addComment(actor: Actor, projectId: string, groupId: string, postId: string, dto: CreateCommentDto) {
    await this.collaboration.authorizeGroup(actor, projectId, groupId, true);
    const targetPost = await this.requirePost(projectId, groupId, postId);
    if (dto.parentId) {
      const parent = await this.prisma.feedComment.findFirst({ where: { id: dto.parentId, projectId, groupId, postId, archivedAt: null } });
      if (!parent) throw new NotFoundException("답글을 작성할 댓글을 찾을 수 없습니다.");
      if (parent.parentId) throw new BadRequestException("답글에는 추가 답글을 작성할 수 없습니다.");
    }
    const content = this.security.plainText(dto.content, "댓글");
    const created = await this.prisma.feedComment.create({ data: { projectId, groupId, postId, authorId: actor.id, parentId: dto.parentId, content }, include: { author: { select: { id: true, name: true } } } });
    const recipients = [...new Set([targetPost.authorId, targetPost.assigneeId].filter((id): id is string => Boolean(id) && id !== actor.id))];
    await this.realtime.publish({ projectId, groupId, postId, type: "comment.created", payload: { comment: { id: created.id, content: created.content, parentId: created.parentId, author: created.author, createdAt: created.createdAt.toISOString() } }, recipientIds: recipients, notificationMessage: recipients.length ? `‘${targetPost.title}’에 새 댓글이 등록되었습니다.` : undefined });
    await this.publishMentions(actor, projectId, groupId, postId, targetPost.title, content);
    return created;
  }

  async prepareAttachment(actor: Actor, projectId: string, groupId: string, postId: string, dto: PrepareAttachmentDto) {
    await this.collaboration.authorizeGroup(actor, projectId, groupId, true);
    await this.requirePost(projectId, groupId, postId);
    const originalName = this.security.fileName(dto.originalName);
    const extension = originalName.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_FILES[extension]?.includes(dto.mimeType)) throw new BadRequestException("허용되지 않는 파일 형식입니다.");
    const storageKey = `projects/${projectId}/groups/${groupId}/posts/${postId}/${randomUUID()}`;
    const attachment = await this.prisma.feedAttachment.create({ data: { projectId, groupId, postId, uploadedById: actor.id, originalName, storageKey, mimeType: dto.mimeType, size: BigInt(dto.size) } });
    const uploadUrl = await getSignedUrl(this.s3, new PutObjectCommand({ Bucket: this.config.getOrThrow<string>("S3_BUCKET"), Key: storageKey, ContentType: dto.mimeType, ContentLength: dto.size }), { expiresIn: 600 });
    return { attachment: this.serializeAttachment(attachment), upload: { method: "PUT", url: uploadUrl, expiresInSeconds: 600, headers: { "content-type": dto.mimeType } } };
  }

  async completeAttachment(actor: Actor, projectId: string, groupId: string, postId: string, attachmentId: string) {
    await this.collaboration.authorizeGroup(actor, projectId, groupId, true);
    const attachment = await this.prisma.feedAttachment.findFirst({ where: { id: attachmentId, projectId, groupId, postId, uploadedById: actor.id, status: "PREPARED" } });
    if (!attachment) throw new NotFoundException("업로드 대기 중인 첨부파일을 찾을 수 없습니다.");
    try {
      const object = await this.s3.send(new HeadObjectCommand({ Bucket: this.config.getOrThrow<string>("S3_BUCKET"), Key: attachment.storageKey }));
      if (object.ContentLength !== Number(attachment.size) || object.ContentType !== attachment.mimeType) throw new Error("OBJECT_MISMATCH");
    } catch {
      await this.prisma.feedAttachment.update({ where: { id: attachment.id }, data: { status: "FAILED" } });
      throw new BadRequestException("업로드된 파일을 확인할 수 없습니다. 다시 업로드해 주세요.");
    }
    const completed = await this.prisma.feedAttachment.update({ where: { id: attachment.id }, data: { status: "AVAILABLE" } });
    return this.serializeAttachment(completed);
  }

  async getAttachmentDownload(actor: Actor, projectId: string, groupId: string, postId: string, attachmentId: string) {
    await this.collaboration.authorizeGroup(actor, projectId, groupId, false);
    const attachment = await this.prisma.feedAttachment.findFirst({ where: { id: attachmentId, projectId, groupId, postId, status: "AVAILABLE", post: { archivedAt: null } } });
    if (!attachment) throw new NotFoundException("첨부파일을 찾을 수 없습니다.");
    const fileName = attachment.originalName.replace(/["\r\n]/g, "_");
    const url = await getSignedUrl(this.s3, new GetObjectCommand({
      Bucket: this.config.getOrThrow<string>("S3_BUCKET"), Key: attachment.storageKey,
      ResponseContentType: attachment.mimeType,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }), { expiresIn: 300 });
    return { url, expiresInSeconds: 300 };
  }

  private requirePost(projectId: string, groupId: string, postId: string) {
    return this.prisma.feedPost.findFirst({ where: { id: postId, projectId, groupId, archivedAt: null } }).then((post) => {
      if (!post) throw new NotFoundException("게시글을 찾을 수 없습니다.");
      return post;
    });
  }

  private async assertAssignee(projectId: string, groupId: string, assigneeId?: string) {
    if (!assigneeId) return;
    const membership = await this.prisma.projectMembership.findFirst({ where: {
      projectId, userId: assigneeId, status: "ACTIVE", user: { isActive: true },
      OR: [
        { role: { in: ["CLIENT_ADMIN", "PROJECT_ADMIN", "PROJECT_PM", "PROJECT_MANAGER"] } },
        { groupMemberships: { some: { groupId } } },
      ],
    } });
    if (!membership) throw new BadRequestException("담당자는 이 협업 그룹의 활성 참여자여야 합니다.");
  }

  private assertCanManagePost(actor: Actor, membership: ProjectMemberView | null, group: GroupView, post: FeedPost) {
    void membership;
    void group;
    void post;
    if (actor.platformRole === "PLATFORM_ADMIN") return;
    throw new ForbiddenException("관리자만 게시글을 수정하거나 삭제할 수 있습니다.");
  }

  private async publishMentions(actor: Actor, projectId: string, groupId: string, postId: string, title: string, content: string) {
    const names = [...content.matchAll(/@([\p{L}\p{N}_-]{2,30})/gu)].map((match) => match[1]!).filter((name, index, all) => all.indexOf(name) === index);
    if (!names.length) return;
    const mentioned = await this.prisma.projectMembership.findMany({
      where: { projectId, status: "ACTIVE", userId: { not: actor.id }, user: { isActive: true, name: { in: names } }, OR: [{ role: { in: ["CLIENT_ADMIN", "PROJECT_ADMIN", "PROJECT_PM", "PROJECT_MANAGER"] } }, { groupMemberships: { some: { groupId } } }] },
      select: { userId: true, user: { select: { name: true } } },
    });
    if (!mentioned.length) return;
    await this.realtime.publish({ projectId, groupId, postId, type: "mention.created", payload: { postId, title, mentionedUserIds: mentioned.map((item) => item.userId), mentionedNames: mentioned.map((item) => item.user.name) }, recipientIds: mentioned.map((item) => item.userId), notificationMessage: `‘${title}’에서 회원님을 멘션했습니다.` });
  }

  private serializeAttachment<T extends { id: string; originalName: string; mimeType: string; size: bigint; status: string; createdAt: Date; updatedAt: Date }>(attachment: T) {
    return { id: attachment.id, originalName: attachment.originalName, mimeType: attachment.mimeType, size: attachment.size.toString(), status: attachment.status, createdAt: attachment.createdAt, updatedAt: attachment.updatedAt };
  }
  private serializePost<T extends { attachments?: Array<{ id: string; originalName: string; mimeType: string; size: bigint; status: string; createdAt: Date; updatedAt: Date }> }>(post: T) { return { ...post, attachments: post.attachments?.map((item) => this.serializeAttachment(item)) }; }
}
