import { ForbiddenException } from "@nestjs/common";

import type { PrismaService } from "../database/prisma.service";
import { AuthService } from "./auth.service";
import type { AuthTokenService } from "./auth-token.service";
import type { PasswordHashService } from "./password-hash.service";
import type { GoogleDriveInvitationService } from "./google-drive-invitation.service";

describe("AuthService 회원가입 승인", () => {
  const findFirst = jest.fn();
  const findUnique = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const findMany = jest.fn();
  const prisma = { user: { findFirst, findUnique, create, update, findMany } } as unknown as PrismaService;
  const passwords = { hash: jest.fn().mockResolvedValue("hashed"), verify: jest.fn() } as unknown as PasswordHashService;
  const tokens = { sign: jest.fn().mockReturnValue("signed-token") } as unknown as AuthTokenService;
  const scheduleDriveInvitation = jest.fn();
  const driveInvitations = { schedule: scheduleDriveInvitation } as unknown as GoogleDriveInvitationService;
  const service = new AuthService(prisma, passwords, tokens, driveInvitations);

  beforeEach(() => jest.clearAllMocks());

  it("회원가입 신청을 비활성 승인 대기 계정으로 저장한다", async () => {
    findFirst.mockResolvedValueOnce(null);
    create.mockResolvedValueOnce({ id: "user-1" });
    await service.register({ name: "홍길동", username: "honggildong", email: "hong@example.com", password: "secure123" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ username: "honggildong", isActive: false, approvalStatus: "PENDING", passwordHash: "hashed" }) }));
  });

  it("승인 대기 계정의 로그인을 거부한다", async () => {
    findUnique.mockResolvedValueOnce({ id: "user-1", username: "honggildong", email: "hong@example.com", name: "홍길동", passwordHash: "hashed", isActive: false, approvalStatus: "PENDING", platformRole: "USER" });
    (passwords.verify as jest.Mock).mockResolvedValueOnce(true);
    await expect(service.login("honggildong", "secure123")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("플랫폼 관리자가 승인하면 계정을 활성화한다", async () => {
    findFirst.mockResolvedValueOnce({ id: "user-1", email: "member@gmail.com" });
    update.mockResolvedValueOnce({ id: "user-1", username: "honggildong", name: "홍길동", approvalStatus: "APPROVED", isActive: true });
    await service.decideRegistration({ id: "admin", isActive: true, platformRole: "PLATFORM_ADMIN" }, "user-1", "APPROVED");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ approvalStatus: "APPROVED", isActive: true, approvedById: "admin" }) }));
    expect(scheduleDriveInvitation).toHaveBeenCalledWith("user-1", "member@gmail.com", "admin");
  });

  it("일반 사용자의 회원가입 승인 요청을 거부한다", async () => {
    await expect(service.decideRegistration({ id: "user", isActive: true, platformRole: "USER" }, "user-1", "APPROVED")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("실제 승인 절차를 완료한 활성 계정만 집계한다", async () => {
    findMany.mockResolvedValueOnce([
      { id: "user-1", platformRole: "USER" },
      { id: "admin-1", platformRole: "PLATFORM_ADMIN" },
    ]);
    const result = await service.listApprovedAccounts({ id: "admin", isActive: true, platformRole: "PLATFORM_ADMIN" });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ approvalStatus: "APPROVED", isActive: true, approvedById: { not: null } }),
    }));
    expect(result.summary).toEqual({ approvedAccounts: 2, administrators: 1, users: 1 });
  });

  it("플랫폼 관리자가 승인 계정의 역할을 변경한다", async () => {
    findFirst.mockResolvedValueOnce({ id: "user-1" });
    update.mockResolvedValueOnce({ id: "user-1", username: "honggildong", name: "홍길동", platformRole: "PLATFORM_ADMIN" });
    await service.updateAccountRole(
      { id: "admin", isActive: true, platformRole: "PLATFORM_ADMIN" },
      "user-1",
      "PLATFORM_ADMIN",
    );
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { platformRole: "PLATFORM_ADMIN" } }));
  });
});
