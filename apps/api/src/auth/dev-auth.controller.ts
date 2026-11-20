import { Body, Controller, NotFoundException, Post, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IsEmail } from "class-validator";

import { PrismaService } from "../database/prisma.service";
import { AuthTokenService } from "./auth-token.service";

class DevSessionDto { @IsEmail() email: string; }

@Controller("auth")
export class DevAuthController {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService, private readonly tokens: AuthTokenService) {}

  @Post("dev-session")
  async createDevSession(@Body() dto: DevSessionDto) {
    if (this.config.get<string>("NODE_ENV") === "production" || this.config.get<string>("ENABLE_DEV_AUTH") !== "true") {
      throw new NotFoundException();
    }
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true, isActive: true, platformRole: true },
    });
    if (!user?.isActive || !user.email.endsWith("@projecthub.local") || user.platformRole === "PLATFORM_ADMIN") {
      throw new UnauthorizedException("개발용 사용자 세션을 발급할 수 없습니다.");
    }
    return { accessToken: this.tokens.sign(user.id, 8 * 60 * 60), user: { id: user.id, name: user.name, email: user.email } };
  }
}
