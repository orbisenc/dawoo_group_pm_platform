import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { CurrentActor } from "./current-actor.decorator";
import type { Actor } from "../projects/collaboration.types";
import { ApiAuthGuard } from "./api-auth.guard";
import { LoginDto, RegisterDto, UpdateAccountRoleDto } from "./auth.dto";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Post("login")
  login(@Body() dto: LoginDto) { return this.auth.login(dto.username, dto.password); }

  @Get("me")
  @UseGuards(ApiAuthGuard)
  me(@CurrentActor() actor: Actor) { return this.auth.me(actor); }

  @Get("registrations")
  @UseGuards(ApiAuthGuard)
  registrations(@CurrentActor() actor: Actor) { return this.auth.listRegistrations(actor); }

  @Get("accounts")
  @UseGuards(ApiAuthGuard)
  accounts(@CurrentActor() actor: Actor) { return this.auth.listApprovedAccounts(actor); }

  @Patch("accounts/:userId/role")
  @UseGuards(ApiAuthGuard)
  updateAccountRole(
    @CurrentActor() actor: Actor,
    @Param("userId") userId: string,
    @Body() dto: UpdateAccountRoleDto,
  ) { return this.auth.updateAccountRole(actor, userId, dto.platformRole); }

  @Patch("registrations/:userId/approve")
  @UseGuards(ApiAuthGuard)
  approve(@CurrentActor() actor: Actor, @Param("userId") userId: string) { return this.auth.decideRegistration(actor, userId, "APPROVED"); }

  @Patch("registrations/:userId/reject")
  @UseGuards(ApiAuthGuard)
  reject(@CurrentActor() actor: Actor, @Param("userId") userId: string) { return this.auth.decideRegistration(actor, userId, "REJECTED"); }
}
