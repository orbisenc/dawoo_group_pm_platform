import { NotFoundException } from "@nestjs/common";

import type { PrismaService } from "../database/prisma.service";
import type { InputSecurityService } from "../feed/input-security.service";
import type { CollaborationService } from "../projects/collaboration.service";
import { DriveService } from "./drive.service";

describe("DriveService 프로젝트 격리", () => {
  it("파일 조회 시 URL의 프로젝트 ID를 쿼리에 강제한다", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { driveFile: { findFirst } } as unknown as PrismaService;
    const collaboration = { authorizeProject: jest.fn().mockResolvedValue({ membership: { role: "PARTICIPANT" } }) } as unknown as CollaborationService;
    const service = new DriveService(prisma, collaboration, {} as InputSecurityService, { getOrThrow: jest.fn() } as never, {} as never);
    await expect(service.downloadFile({ id: "user-1", isActive: true, platformRole: "USER" }, "project-a", "file-from-project-b")).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({ where: { id: "file-from-project-b", projectId: "project-a", deletedAt: null } });
  });

  it("프로젝트 권한 검증 후에만 목록을 조회한다", async () => {
    const authorizeProject = jest.fn().mockRejectedValue(new NotFoundException());
    const transaction = jest.fn();
    const service = new DriveService({ $transaction: transaction } as unknown as PrismaService, { authorizeProject } as unknown as CollaborationService, {} as InputSecurityService, {} as never, {} as never);
    await expect(service.list({ id: "outsider", isActive: true, platformRole: "USER" }, "private-project", {})).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("소속되지 않은 그룹 전용 폴더와 그 파일을 목록에서 제외한다", async () => {
    const folderFindMany = jest.fn()
      .mockResolvedValueOnce([{ id: "restricted-folder", parentId: null, isRestricted: false, groupAccess: [{ groupId: "group-a" }] }])
      .mockResolvedValueOnce([]);
    const fileFindMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      driveFolder: { findMany: folderFindMany }, driveFile: { findMany: fileFindMany },
      groupMembership: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: (operations: Array<Promise<unknown>>) => Promise.all(operations),
    } as unknown as PrismaService;
    const collaboration = { authorizeProject: jest.fn().mockResolvedValue({ membership: { id: "member-1", role: "PARTICIPANT" } }) } as unknown as CollaborationService;
    const service = new DriveService(prisma, collaboration, {} as InputSecurityService, {} as never, {} as never);
    await service.list({ id: "user-1", isActive: true, platformRole: "USER" }, "project-a", {});
    expect(folderFindMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { notIn: ["restricted-folder"] } }) }));
    expect(fileFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ AND: { OR: [{ folderId: null }, { folderId: { notIn: ["restricted-folder"] } }] } }) }));
  });

  it("대시보드 파일 검색에서도 접근 불가 폴더를 제외한다", async () => {
    const fileFindMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      driveFolder: { findMany: jest.fn().mockResolvedValue([{ id: "private-folder", parentId: null, isRestricted: false, groupAccess: [{ groupId: "group-secret" }] }]) },
      driveFile: { findMany: fileFindMany },
      groupMembership: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const collaboration = { authorizeProject: jest.fn().mockResolvedValue({ membership: { id: "member-1", role: "PARTICIPANT" } }) } as unknown as CollaborationService;
    const service = new DriveService(prisma, collaboration, {} as InputSecurityService, {} as never, {} as never);
    await service.listRecentAccessibleFiles({ id: "user-1", isActive: true, platformRole: "USER" }, "project-a", 8, "계약");
    expect(fileFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ projectId: "project-a", name: { contains: "계약", mode: "insensitive" }, OR: [{ folderId: null }, { folderId: { notIn: ["private-folder"] } }] }) }));
  });
});
