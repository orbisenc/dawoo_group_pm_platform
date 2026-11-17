import { randomUUID } from "node:crypto";

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type DriveFile, type DriveFolder, type ProjectRole } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { InputSecurityService } from "../feed/input-security.service";
import { S3_CLIENT } from "../infrastructure/infrastructure.constants";
import type { Actor } from "../projects/collaboration.types";
import { CollaborationService } from "../projects/collaboration.service";
import type { CreateDriveFolderDto, DriveListDto, PrepareDriveFileDto, UpdateDriveFileDto, UpdateDriveFolderDto } from "./drive.dto";

const DRIVE_MANAGER_ROLES = new Set<ProjectRole>(["CLIENT_ADMIN", "PROJECT_ADMIN", "PROJECT_PM", "PROJECT_MANAGER"]);
const ALLOWED_EXTENSIONS = new Set(["dwg", "dxf", "ifc", "rvt", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "jpg", "jpeg", "png", "webp", "zip"]);

@Injectable()
export class DriveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collaboration: CollaborationService,
    private readonly security: InputSecurityService,
    private readonly config: ConfigService,
    @Inject(S3_CLIENT) private readonly s3: S3Client,
  ) {}

  async list(actor: Actor, projectId: string, dto: DriveListDto) {
    const access = await this.collaboration.authorizeProject(actor, projectId, false);
    if (dto.parentId) await this.requireFolder(actor, projectId, dto.parentId, access.membership?.role ?? null, access.membership?.id);
    const hiddenIds = await this.hiddenFolderIds(actor, projectId, access.membership?.role ?? null, access.membership?.id);
    const query = dto.query?.trim();
    const folderWhere: Prisma.DriveFolderWhereInput = { projectId, deletedAt: null, id: hiddenIds.length ? { notIn: hiddenIds } : undefined };
    const visibleFileFolder: Prisma.DriveFileWhereInput | undefined = hiddenIds.length ? { OR: [{ folderId: null }, { folderId: { notIn: hiddenIds } }] } : undefined;
    const [folders, files] = await this.prisma.$transaction([
      this.prisma.driveFolder.findMany({ where: { ...folderWhere, parentId: query ? undefined : dto.parentId ?? null, name: query ? { contains: query, mode: "insensitive" as const } : undefined }, orderBy: { name: "asc" }, include: { createdBy: { select: { name: true } }, groupAccess: { select: { groupId: true, canWrite: true, group: { select: { name: true } } } } } }),
      this.prisma.driveFile.findMany({ where: { projectId, deletedAt: null, AND: visibleFileFolder, folderId: query ? undefined : dto.parentId ?? null, name: query ? { contains: query, mode: "insensitive" as const } : undefined, versions: { some: { status: "AVAILABLE" } } }, orderBy: { name: "asc" }, include: { createdBy: { select: { name: true } }, versions: { where: { status: "AVAILABLE" }, orderBy: { version: "desc" }, take: 1 }, issueLinks: { include: { post: { select: { id: true, title: true, groupId: true } } } } } }),
    ]);
    return { folders, files: files.map((file) => this.serializeFile(file)) };
  }

  async createFolder(actor: Actor, projectId: string, dto: CreateDriveFolderDto) {
    const access = await this.collaboration.authorizeProject(actor, projectId, true);
    if (dto.parentId) await this.requireFolder(actor, projectId, dto.parentId, access.membership?.role ?? null, access.membership?.id, true);
    this.assertRestrictedManager(actor, access.membership?.role ?? null, dto.isRestricted, dto.groupIds);
    await this.assertGroups(projectId, dto.groupIds);
    const name = this.folderName(dto.name);
    await this.assertUniqueName(projectId, dto.parentId ?? null, name);
    return this.prisma.driveFolder.create({ data: { projectId, parentId: dto.parentId, createdById: actor.id, name, isRestricted: dto.isRestricted, groupAccess: dto.groupIds?.length ? { create: dto.groupIds.map((groupId) => ({ groupId, canWrite: true })) } : undefined }, include: { groupAccess: { select: { groupId: true, canWrite: true } } } });
  }

  async updateFolder(actor: Actor, projectId: string, folderId: string, dto: UpdateDriveFolderDto) {
    const access = await this.collaboration.authorizeProject(actor, projectId, true);
    const folder = await this.requireFolder(actor, projectId, folderId, access.membership?.role ?? null, access.membership?.id, true);
    this.assertRestrictedManager(actor, access.membership?.role ?? null, dto.isRestricted, dto.groupIds);
    await this.assertGroups(projectId, dto.groupIds);
    if (dto.parentId === folderId) throw new BadRequestException("폴더를 자기 자신 안으로 이동할 수 없습니다.");
    if (dto.parentId) {
      await this.requireFolder(actor, projectId, dto.parentId, access.membership?.role ?? null, access.membership?.id, true);
      await this.assertNotDescendant(projectId, folderId, dto.parentId);
    }
    const name = dto.name === undefined ? folder.name : this.folderName(dto.name);
    const parentId = dto.parentId === undefined ? folder.parentId : dto.parentId;
    if (name !== folder.name || parentId !== folder.parentId) await this.assertUniqueName(projectId, parentId, name, folderId);
    const parentSpecified = Object.prototype.hasOwnProperty.call(dto, "parentId");
    return this.prisma.driveFolder.update({ where: { id: folderId }, data: { name: dto.name === undefined ? undefined : name, parentId: parentSpecified ? dto.parentId : undefined, isRestricted: dto.isRestricted, groupAccess: dto.groupIds === undefined ? undefined : { deleteMany: {}, create: dto.groupIds.map((groupId) => ({ groupId, canWrite: true })) } }, include: { groupAccess: { select: { groupId: true, canWrite: true } } } });
  }

  async deleteFolder(actor: Actor, projectId: string, folderId: string) {
    const access = await this.collaboration.authorizeProject(actor, projectId, true);
    await this.requireFolder(actor, projectId, folderId, access.membership?.role ?? null, access.membership?.id, true);
    const children = await this.prisma.driveFolder.count({ where: { projectId, parentId: folderId, deletedAt: null } });
    const files = await this.prisma.driveFile.count({ where: { projectId, folderId, deletedAt: null } });
    if (children || files) throw new BadRequestException("비어 있지 않은 폴더는 삭제할 수 없습니다.");
    await this.prisma.driveFolder.update({ where: { id: folderId }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  async prepareFile(actor: Actor, projectId: string, dto: PrepareDriveFileDto) {
    const access = await this.collaboration.authorizeProject(actor, projectId, true);
    const originalName = this.security.fileName(dto.originalName);
    const extension = originalName.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(extension)) throw new BadRequestException("허용되지 않는 파일 형식입니다.");
    if (!dto.mimeType || /[\r\n]/u.test(dto.mimeType)) throw new BadRequestException("올바른 파일 형식 정보가 필요합니다.");
    let file: DriveFile;
    let version: number;
    if (dto.fileId) {
      file = await this.requireFile(actor, projectId, dto.fileId, access.membership?.role ?? null, access.membership?.id, true);
      version = (await this.prisma.driveFileVersion.aggregate({ where: { projectId, fileId: file.id }, _max: { version: true } }))._max.version ?? 0;
      version += 1;
    } else {
      if (dto.folderId) await this.requireFolder(actor, projectId, dto.folderId, access.membership?.role ?? null, access.membership?.id, true);
      file = await this.prisma.driveFile.create({ data: { projectId, folderId: dto.folderId, createdById: actor.id, name: originalName } });
      version = 1;
    }
    const storageKey = `projects/${projectId}/drive/${file.id}/v${version}/${randomUUID()}`;
    const record = await this.prisma.driveFileVersion.create({ data: { projectId, fileId: file.id, uploadedById: actor.id, version, originalName, storageKey, mimeType: dto.mimeType, size: BigInt(dto.size), sha256: dto.sha256 } });
    const url = await getSignedUrl(this.s3, new PutObjectCommand({ Bucket: this.bucket(), Key: storageKey, ContentType: dto.mimeType, ContentLength: dto.size }), { expiresIn: 600 });
    return { file: { id: file.id, name: file.name }, version: this.serializeVersion(record), upload: { method: "PUT", url, expiresInSeconds: 600, headers: { "content-type": dto.mimeType } } };
  }

  async completeFile(actor: Actor, projectId: string, fileId: string, versionId: string) {
    const access = await this.collaboration.authorizeProject(actor, projectId, true);
    await this.requireFile(actor, projectId, fileId, access.membership?.role ?? null, access.membership?.id, true);
    const version = await this.prisma.driveFileVersion.findFirst({ where: { id: versionId, fileId, projectId, uploadedById: actor.id, status: "PREPARED", file: { deletedAt: null } } });
    if (!version) throw new NotFoundException("업로드 대기 중인 파일 버전을 찾을 수 없습니다.");
    try {
      const object = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket(), Key: version.storageKey }));
      if (object.ContentLength !== Number(version.size) || object.ContentType !== version.mimeType) throw new Error("OBJECT_MISMATCH");
    } catch {
      await this.prisma.driveFileVersion.update({ where: { id: version.id }, data: { status: "FAILED" } });
      throw new BadRequestException("업로드된 파일을 확인할 수 없습니다. 다시 업로드해 주세요.");
    }
    return this.serializeVersion(await this.prisma.driveFileVersion.update({ where: { id: version.id }, data: { status: "AVAILABLE" } }));
  }

  async downloadFile(actor: Actor, projectId: string, fileId: string) {
    const access = await this.collaboration.authorizeProject(actor, projectId, false);
    const file = await this.requireFile(actor, projectId, fileId, access.membership?.role ?? null, access.membership?.id);
    const version = await this.prisma.driveFileVersion.findFirst({ where: { projectId, fileId, status: "AVAILABLE" }, orderBy: { version: "desc" } });
    if (!version) throw new NotFoundException("다운로드할 파일 버전을 찾을 수 없습니다.");
    const safeName = file.name.replace(/["\r\n]/gu, "_");
    const url = await getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket(), Key: version.storageKey, ResponseContentType: version.mimeType, ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}` }), { expiresIn: 300 });
    return { url, expiresInSeconds: 300, version: version.version };
  }

  async previewFile(actor: Actor, projectId: string, fileId: string) {
    const access = await this.collaboration.authorizeProject(actor, projectId, false);
    const file = await this.requireFile(actor, projectId, fileId, access.membership?.role ?? null, access.membership?.id);
    const version = await this.prisma.driveFileVersion.findFirst({ where: { projectId, fileId, status: "AVAILABLE" }, orderBy: { version: "desc" } });
    if (!version || (version.mimeType !== "application/pdf" && !version.mimeType.startsWith("image/"))) throw new BadRequestException("PDF와 이미지만 미리 볼 수 있습니다.");
    const safeName = file.name.replace(/["\r\n]/gu, "_");
    const url = await getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket(), Key: version.storageKey, ResponseContentType: version.mimeType, ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(safeName)}` }), { expiresIn: 300 });
    return { url, mimeType: version.mimeType, expiresInSeconds: 300, version: version.version };
  }

  async listVersions(actor: Actor, projectId: string, fileId: string) {
    const access = await this.collaboration.authorizeProject(actor, projectId, false);
    await this.requireFile(actor, projectId, fileId, access.membership?.role ?? null, access.membership?.id);
    const versions = await this.prisma.driveFileVersion.findMany({ where: { projectId, fileId, status: "AVAILABLE" }, orderBy: { version: "desc" }, include: { uploadedBy: { select: { name: true } } } });
    return versions.map((version) => this.serializeVersion(version));
  }

  async listApprovalFiles(actor: Actor, projectId: string) {
    const access = await this.collaboration.authorizeProject(actor, projectId, false);
    const hiddenIds = await this.hiddenFolderIds(actor, projectId, access.membership?.role ?? null, access.membership?.id);
    const files = await this.prisma.driveFile.findMany({
      where: { projectId, deletedAt: null, OR: [{ folderId: null }, { folderId: hiddenIds.length ? { notIn: hiddenIds } : { not: null } }], versions: { some: { status: "AVAILABLE", sha256: { not: null } } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, versions: { where: { status: "AVAILABLE", sha256: { not: null } }, orderBy: { version: "desc" }, select: { id: true, version: true, originalName: true, sha256: true, size: true, mimeType: true } } },
    });
    return files.map((file) => ({ ...file, versions: file.versions.map((version) => ({ ...version, size: version.size.toString() })) }));
  }

  async approvalVersion(actor: Actor, projectId: string, fileId: string, versionId: string) {
    const access = await this.collaboration.authorizeProject(actor, projectId, false);
    const file = await this.requireFile(actor, projectId, fileId, access.membership?.role ?? null, access.membership?.id);
    const version = await this.prisma.driveFileVersion.findFirst({ where: { id: versionId, fileId, projectId, status: "AVAILABLE", sha256: { not: null } } });
    if (!version?.sha256) throw new NotFoundException("결재할 수 있는 파일 버전을 찾을 수 없습니다.");
    return { file, version };
  }

  async listRecentAccessibleFiles(actor: Actor, projectId: string, take = 8, query?: string) {
    const access = await this.collaboration.authorizeProject(actor, projectId, false);
    const hiddenIds = await this.hiddenFolderIds(actor, projectId, access.membership?.role ?? null, access.membership?.id);
    const files = await this.prisma.driveFile.findMany({
      where: {
        projectId,
        deletedAt: null,
        name: query ? { contains: query, mode: "insensitive" } : undefined,
        OR: [{ folderId: null }, { folderId: hiddenIds.length ? { notIn: hiddenIds } : { not: null } }],
        versions: { some: { status: "AVAILABLE" } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: Math.min(Math.max(take, 1), 20),
      include: {
        folder: { select: { id: true, name: true } },
        versions: { where: { status: "AVAILABLE" }, orderBy: { version: "desc" }, take: 1, include: { uploadedBy: { select: { name: true } } } },
      },
    });
    return files.map((file) => this.serializeFile(file));
  }

  async countAccessibleFiles(actor: Actor, projectId: string) {
    const access = await this.collaboration.authorizeProject(actor, projectId, false);
    const hiddenIds = await this.hiddenFolderIds(actor, projectId, access.membership?.role ?? null, access.membership?.id);
    return this.prisma.driveFile.count({ where: { projectId, deletedAt: null, OR: [{ folderId: null }, { folderId: hiddenIds.length ? { notIn: hiddenIds } : { not: null } }], versions: { some: { status: "AVAILABLE" } } } });
  }

  async updateFile(actor: Actor, projectId: string, fileId: string, dto: UpdateDriveFileDto) {
    const access = await this.collaboration.authorizeProject(actor, projectId, true);
    await this.requireFile(actor, projectId, fileId, access.membership?.role ?? null, access.membership?.id, true);
    if (dto.folderId) await this.requireFolder(actor, projectId, dto.folderId, access.membership?.role ?? null, access.membership?.id, true);
    const name = dto.name === undefined ? undefined : this.security.fileName(dto.name);
    const folderSpecified = Object.prototype.hasOwnProperty.call(dto, "folderId");
    return this.prisma.driveFile.update({ where: { id: fileId }, data: { name, folderId: folderSpecified ? dto.folderId : undefined } });
  }

  async deleteFile(actor: Actor, projectId: string, fileId: string) {
    const access = await this.collaboration.authorizeProject(actor, projectId, true);
    await this.requireFile(actor, projectId, fileId, access.membership?.role ?? null, access.membership?.id, true);
    await this.prisma.driveFile.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  async linkIssue(actor: Actor, projectId: string, fileId: string, postId: string) {
    const access = await this.collaboration.authorizeProject(actor, projectId, true);
    await this.requireFile(actor, projectId, fileId, access.membership?.role ?? null, access.membership?.id, true);
    const post = await this.prisma.feedPost.findFirst({ where: { id: postId, projectId, archivedAt: null }, select: { id: true, title: true, groupId: true } });
    if (!post) throw new NotFoundException("연결할 이슈를 찾을 수 없습니다.");
    await this.collaboration.authorizeGroup(actor, projectId, post.groupId, false);
    return this.prisma.driveFileIssueLink.upsert({ where: { fileId_postId: { fileId, postId } }, update: {}, create: { projectId, fileId, postId, createdById: actor.id }, include: { post: { select: { id: true, title: true, groupId: true } } } });
  }

  async unlinkIssue(actor: Actor, projectId: string, fileId: string, postId: string) {
    const access = await this.collaboration.authorizeProject(actor, projectId, true);
    await this.requireFile(actor, projectId, fileId, access.membership?.role ?? null, access.membership?.id, true);
    const link = await this.prisma.driveFileIssueLink.findFirst({ where: { projectId, fileId, postId } });
    if (!link) throw new NotFoundException("파일과 이슈 연결을 찾을 수 없습니다.");
    await this.prisma.driveFileIssueLink.delete({ where: { id: link.id } });
    return { deleted: true };
  }

  private async requireFolder(actor: Actor, projectId: string, folderId: string, role: ProjectRole | null, membershipId?: string, write = false) {
    const folder = await this.prisma.driveFolder.findFirst({ where: { id: folderId, projectId, deletedAt: null }, include: { groupAccess: true } });
    if (!folder || !await this.canAccessFolderPath(actor, projectId, folder, role, membershipId, write)) throw new NotFoundException("폴더를 찾을 수 없습니다.");
    return folder;
  }

  private async requireFile(actor: Actor, projectId: string, fileId: string, role: ProjectRole | null, membershipId?: string, write = false) {
    const file = await this.prisma.driveFile.findFirst({ where: { id: fileId, projectId, deletedAt: null } });
    if (!file) throw new NotFoundException("파일을 찾을 수 없습니다.");
    if (file.folderId) await this.requireFolder(actor, projectId, file.folderId, role, membershipId, write);
    return file;
  }

  private async hiddenFolderIds(actor: Actor, projectId: string, role: ProjectRole | null, membershipId?: string) {
    if (this.isManager(actor, role)) return [];
    const [folders, memberships] = await Promise.all([
      this.prisma.driveFolder.findMany({ where: { projectId, deletedAt: null }, select: { id: true, parentId: true, isRestricted: true, groupAccess: { select: { groupId: true } } } }),
      membershipId ? this.prisma.groupMembership.findMany({ where: { projectMembershipId: membershipId }, select: { groupId: true } }) : [],
    ]);
    const groups = new Set(memberships.map((item) => item.groupId));
    const hidden = new Set(folders.filter((folder) => folder.isRestricted || (folder.groupAccess.length > 0 && !folder.groupAccess.some((item) => groups.has(item.groupId)))).map((folder) => folder.id));
    let changed = true;
    while (changed) { changed = false; for (const folder of folders) if (folder.parentId && hidden.has(folder.parentId) && !hidden.has(folder.id)) { hidden.add(folder.id); changed = true; } }
    return [...hidden];
  }

  private async canAccessFolderPath(actor: Actor, projectId: string, folder: DriveFolder & { groupAccess: Array<{ groupId: string; canWrite: boolean }> }, role: ProjectRole | null, membershipId: string | undefined, write: boolean) {
    if (this.isManager(actor, role)) return true;
    const memberships = membershipId ? await this.prisma.groupMembership.findMany({ where: { projectMembershipId: membershipId }, select: { groupId: true, role: true } }) : [];
    const groups = new Map(memberships.map((item) => [item.groupId, item.role]));
    let current: typeof folder | null = folder;
    for (let depth = 0; current && depth < 100; depth += 1) {
      if (current.isRestricted) return false;
      if (current.groupAccess.length && !current.groupAccess.some((item) => groups.has(item.groupId) && (!write || item.canWrite && groups.get(item.groupId) !== "READ_ONLY"))) return false;
      current = current.parentId ? await this.prisma.driveFolder.findFirst({ where: { id: current.parentId, projectId, deletedAt: null }, include: { groupAccess: true } }) : null;
    }
    return true;
  }

  private async assertNotDescendant(projectId: string, folderId: string, destinationId: string) {
    let current: { parentId: string | null } | null = await this.prisma.driveFolder.findFirst({ where: { id: destinationId, projectId, deletedAt: null }, select: { parentId: true } });
    let id: string | null = destinationId;
    for (let depth = 0; current && id && depth < 100; depth += 1) {
      if (id === folderId) throw new BadRequestException("하위 폴더 안으로 이동할 수 없습니다.");
      id = current.parentId;
      current = id ? await this.prisma.driveFolder.findFirst({ where: { id, projectId, deletedAt: null }, select: { parentId: true } }) : null;
    }
  }

  private async assertUniqueName(projectId: string, parentId: string | null, name: string, exceptId?: string) {
    const duplicate = await this.prisma.driveFolder.findFirst({ where: { projectId, parentId, deletedAt: null, name: { equals: name, mode: "insensitive" }, id: exceptId ? { not: exceptId } : undefined } });
    if (duplicate) throw new BadRequestException("같은 위치에 동일한 이름의 폴더가 있습니다.");
  }

  private assertRestrictedManager(actor: Actor, role: ProjectRole | null, restricted?: boolean, groupIds?: string[]) {
    if ((restricted || groupIds !== undefined) && !this.isManager(actor, role)) throw new ForbiddenException("제한 폴더와 그룹 권한은 프로젝트 관리자만 설정할 수 있습니다.");
  }
  private async assertGroups(projectId: string, groupIds?: string[]) { if (!groupIds?.length) return; const count = await this.prisma.collaborationGroup.count({ where: { projectId, id: { in: [...new Set(groupIds)] } } }); if (count !== new Set(groupIds).size) throw new BadRequestException("같은 프로젝트의 협업 그룹만 지정할 수 있습니다."); }
  private isManager(actor: Actor, role: ProjectRole | null) { return actor.platformRole === "PLATFORM_ADMIN" || Boolean(role && DRIVE_MANAGER_ROLES.has(role)); }
  private folderName(value: string) { const name = this.security.plainText(value, "폴더명"); if (name.includes("/") || name.includes("\\") || name === "." || name === "..") throw new BadRequestException("올바른 폴더명을 입력해 주세요."); return name; }
  private bucket() { return this.config.getOrThrow<string>("S3_BUCKET"); }
  private serializeVersion<T extends { id: string; version: number; originalName: string; mimeType: string; size: bigint; status: string; createdAt: Date; sha256?: string | null; uploadedBy?: { name: string } }>(item: T) { return { id: item.id, version: item.version, originalName: item.originalName, mimeType: item.mimeType, size: item.size.toString(), sha256: item.sha256 ?? null, status: item.status, createdAt: item.createdAt, uploadedBy: item.uploadedBy }; }
  private serializeFile<T extends { versions: Array<{ id: string; version: number; originalName: string; mimeType: string; size: bigint; status: string; createdAt: Date; sha256?: string | null }>; [key: string]: unknown }>(file: T) { return { ...file, versions: file.versions.map((version) => this.serializeVersion(version)) }; }
}
