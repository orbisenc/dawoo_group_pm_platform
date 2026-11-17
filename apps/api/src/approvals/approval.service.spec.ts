import { ForbiddenException, NotFoundException } from "@nestjs/common";

import type { PrismaService } from "../database/prisma.service";
import type { DriveService } from "../drive/drive.service";
import type { InputSecurityService } from "../feed/input-security.service";
import type { CollaborationService } from "../projects/collaboration.service";
import { ApprovalService } from "./approval.service";

const actor = { id: "user-1", isActive: true, platformRole: "USER" as const };

describe("ApprovalService 권한 및 상태", () => {
  it("프로젝트 비멤버의 결재 목록 쿼리를 차단한다", async () => {
    const findMany = jest.fn();
    const collaboration = { authorizeProject: jest.fn().mockRejectedValue(new NotFoundException()) } as unknown as CollaborationService;
    const service = new ApprovalService({ approvalDocument: { findMany } } as unknown as PrismaService, collaboration, {} as DriveService, {} as InputSecurityService);
    await expect(service.list(actor, "private-project", { scope: "all" })).rejects.toBeInstanceOf(NotFoundException);
    expect(findMany).not.toHaveBeenCalled();
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
});
