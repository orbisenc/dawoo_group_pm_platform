import { ForbiddenException, NotFoundException } from "@nestjs/common";

import type { PrismaService } from "../database/prisma.service";
import type { DriveService } from "../drive/drive.service";
import type { InputSecurityService } from "../feed/input-security.service";
import type { CollaborationService } from "../projects/collaboration.service";
import { ApprovalService } from "./approval.service";

const actor = { id: "user-1", isActive: true, platformRole: "USER" as const };

describe("ApprovalService 권한 및 상태", () => {
  it("프로젝트 비멤버에게 자신이 배정된 상신 문서만 조회한다", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const collaboration = { authorizeProject: jest.fn().mockRejectedValue(new NotFoundException()) } as unknown as CollaborationService;
    const service = new ApprovalService({ approvalDocument: { findMany } } as unknown as PrismaService, collaboration, {} as DriveService, {} as InputSecurityService);
    await expect(service.list(actor, "private-project", { scope: "all" })).resolves.toEqual({ items: [] });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ projectId: "private-project", status: "IN_REVIEW" }),
    }));
  });

  it("결재 컨텍스트에 승인 완료된 활성 회원 전체를 반환한다", async () => {
    const prisma = {
      user: { findMany: jest.fn().mockResolvedValue([{ id: "member-1", name: "프로젝트 회원" }, { id: "approved-2", name: "승인 회원" }]) },
      projectMembership: { findMany: jest.fn().mockResolvedValue([{ userId: "member-1", role: "PARTICIPANT" }]) },
    } as unknown as PrismaService;
    const collaboration = { authorizeProject: jest.fn().mockResolvedValue({ membership: { role: "PARTICIPANT" } }) } as unknown as CollaborationService;
    const drive = { listApprovalFiles: jest.fn().mockResolvedValue([]) } as unknown as DriveService;
    const service = new ApprovalService(prisma, collaboration, drive, {} as InputSecurityService);

    await expect(service.context(actor, "project-1")).resolves.toEqual({
      files: [],
      members: [
        { user: { id: "member-1", name: "프로젝트 회원" }, role: "PARTICIPANT", projectMember: true },
        { user: { id: "approved-2", name: "승인 회원" }, role: "APPROVED_USER", projectMember: false },
      ],
    });
  });

  it("승인되지 않았거나 비활성인 계정을 결재자로 저장하지 않는다", async () => {
    const prisma = { user: { count: jest.fn().mockResolvedValue(1) } } as unknown as PrismaService;
    const collaboration = { authorizeProject: jest.fn().mockResolvedValue({ membership: { role: "PARTICIPANT" } }) } as unknown as CollaborationService;
    const service = new ApprovalService(prisma, collaboration, {} as DriveService, {} as InputSecurityService);

    await expect(service.createRouteTemplate(actor, "project-1", {
      name: "승인 결재선",
      approverIds: ["10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002"],
    })).rejects.toBeInstanceOf(NotFoundException);
    expect((prisma as unknown as { user: { count: jest.Mock } }).user.count).toHaveBeenCalledWith({
      where: {
        id: { in: ["10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002"] },
        approvalStatus: "APPROVED",
        isActive: true,
      },
    });
  });

  it("현재 순번이 아닌 사용자의 승인 요청을 거부한다", async () => {
    const prisma = { approvalDocument: { findFirst: jest.fn().mockResolvedValue({ id: "doc-1", projectId: "project-1", status: "IN_REVIEW", currentRevision: 1, createdById: "author", title: "품의" }) }, approvalRevision: { findUnique: jest.fn().mockResolvedValue({ id: "rev-1", steps: [{ id: "step-1", sequence: 1, status: "ACTIVE", approverId: "other-user" }] }) } } as unknown as PrismaService;
    const collaboration = { authorizeProject: jest.fn().mockResolvedValue({ membership: { role: "PARTICIPANT" } }) } as unknown as CollaborationService;
    const service = new ApprovalService(prisma, collaboration, {} as DriveService, {} as InputSecurityService);
    await expect(service.approve(actor, "project-1", "doc-1", "검토 완료")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("기안자가 아닌 사용자의 회수 요청을 거부한다", async () => {
    const prisma = { approvalDocument: { findFirst: jest.fn().mockResolvedValue({ id: "doc-1", projectId: "project-1", status: "IN_REVIEW", currentRevision: 1, createdById: "author" }) } } as unknown as PrismaService;
    const collaboration = { authorizeProject: jest.fn().mockResolvedValue({ membership: { role: "PARTICIPANT" } }) } as unknown as CollaborationService;
    const service = new ApprovalService(prisma, collaboration, {} as DriveService, {} as InputSecurityService);
    await expect(service.withdraw(actor, "project-1", "doc-1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("다른 사용자가 만든 결재선 템플릿 수정을 차단한다", async () => {
    const prisma = { approvalRouteTemplate: { findFirst: jest.fn().mockResolvedValue({ id: "template-1", projectId: "project-1", createdById: "other-user" }) } } as unknown as PrismaService;
    const collaboration = { authorizeProject: jest.fn().mockResolvedValue({ membership: { role: "PARTICIPANT" } }) } as unknown as CollaborationService;
    const service = new ApprovalService(prisma, collaboration, {} as DriveService, {} as InputSecurityService);
    await expect(service.updateRouteTemplate(actor, "project-1", "template-1", { name: "변경 결재선" })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
