import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import type { Actor } from "../projects/collaboration.types";
import type { RegisterDto } from "./auth.dto";
import { AuthTokenService } from "./auth-token.service";
import { GoogleDriveInvitationService } from "./google-drive-invitation.service";
import { PasswordHashService } from "./password-hash.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordHashService,
    private readonly tokens: AuthTokenService,
    private readonly driveInvitations: GoogleDriveInvitationService,
  ) {}

  async register(dto: RegisterDto) {
    const username = dto.username.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();
    const duplicate = await this.prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { username: true, email: true },
    });
    if (duplicate) throw new ConflictException("이미 사용 중인 아이디 또는 이메일입니다.");

    await this.prisma.user.create({
      data: {
        username,
        email,
        name: dto.name.trim(),
        passwordHash: await this.passwords.hash(dto.password),
        isActive: false,
        approvalStatus: "PENDING",
      },
      select: { id: true },
    });
    return { message: "회원가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다." };
  }

  async login(usernameValue: string, password: string) {
    const username = usernameValue.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, email: true, name: true, passwordHash: true, isActive: true, approvalStatus: true, platformRole: true },
    });
    if (!user || !(await this.passwords.verify(password, user.passwordHash))) {
      throw new UnauthorizedException("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
    if (user.approvalStatus === "PENDING") throw new ForbiddenException("관리자 승인 대기 중인 계정입니다.");
    if (user.approvalStatus === "REJECTED") throw new ForbiddenException("회원가입 신청이 승인되지 않았습니다. 관리자에게 문의해 주세요.");
    if (!user.isActive) throw new ForbiddenException("사용이 중지된 계정입니다.");
    return {
      accessToken: this.tokens.sign(user.id, 8 * 60 * 60),
      user: this.publicUser(user),
    };
  }

  async me(actor: Actor) {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, username: true, email: true, name: true, platformRole: true },
    });
    if (!user) throw new UnauthorizedException("로그인 정보를 확인할 수 없습니다.");
    return this.publicUser(user);
  }

  async listRegistrations(actor: Actor) {
    this.assertPlatformAdmin(actor);
    return this.prisma.user.findMany({
      where: { approvalStatus: "PENDING" },
      select: { id: true, username: true, email: true, name: true, approvalStatus: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async listApprovedAccounts(actor: Actor) {
    this.assertPlatformAdmin(actor);
    const accounts = await this.prisma.user.findMany({
      where: {
        approvalStatus: "APPROVED",
        isActive: true,
        approvedById: { not: null },
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        platformRole: true,
        approvedAt: true,
        createdAt: true,
      },
      orderBy: { approvedAt: "desc" },
    });
    const administrators = accounts.filter((account) => account.platformRole === "PLATFORM_ADMIN").length;
    return {
      summary: {
        approvedAccounts: accounts.length,
        administrators,
        users: accounts.length - administrators,
      },
      items: accounts,
    };
  }

  async updateAccountRole(actor: Actor, userId: string, platformRole: "PLATFORM_ADMIN" | "USER") {
    this.assertPlatformAdmin(actor);
    const account = await this.prisma.user.findFirst({
      where: {
        id: userId,
        approvalStatus: "APPROVED",
        isActive: true,
        approvedById: { not: null },
      },
      select: { id: true },
    });
    if (!account) throw new NotFoundException("승인 완료된 가입 계정을 찾을 수 없습니다.");
    return this.prisma.user.update({
      where: { id: userId },
      data: { platformRole },
      select: { id: true, username: true, name: true, platformRole: true },
    });
  }

  async decideRegistration(actor: Actor, userId: string, decision: "APPROVED" | "REJECTED") {
    this.assertPlatformAdmin(actor);
    const pending = await this.prisma.user.findFirst({ where: { id: userId, approvalStatus: "PENDING" }, select: { id: true, email: true } });
    if (!pending) throw new NotFoundException("승인 대기 중인 회원가입 신청을 찾을 수 없습니다.");
    const account = await this.prisma.user.update({
      where: { id: userId },
      data: {
        approvalStatus: decision,
        isActive: decision === "APPROVED",
        approvedAt: new Date(),
        approvedById: actor.id,
      },
      select: { id: true, username: true, name: true, approvalStatus: true, isActive: true },
    });
    if (decision === "APPROVED") await this.driveInvitations.schedule(pending.id, pending.email, actor.id);
    return account;
  }

  private assertPlatformAdmin(actor: Actor) {
    if (actor.platformRole !== "PLATFORM_ADMIN") throw new ForbiddenException("관리자만 회원가입 신청을 처리할 수 있습니다.");
  }

  private publicUser(user: { id: string; username: string | null; email: string; name: string; platformRole: "PLATFORM_ADMIN" | "USER" }) {
    return { id: user.id, username: user.username, email: user.email, name: user.name, platformRole: user.platformRole };
  }
}
