import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

import { CollaborationRepository } from "../projects/collaboration.types";
import { AuthTokenService } from "./auth-token.service";

type AuthenticatedRequest = { headers: Record<string, string | string[] | undefined>; user?: unknown };

@Injectable()
export class ApiAuthGuard implements CanActivate {
  constructor(private readonly repository: CollaborationRepository, private readonly tokens: AuthTokenService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const headerValue = request.headers.authorization;
    const authorization = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    const userId = token ? this.tokens.verify(token) : null;
    if (!userId) throw new UnauthorizedException("유효한 로그인이 필요합니다.");
    const actor = await this.repository.findActor(userId);
    if (!actor?.isActive) throw new UnauthorizedException("사용할 수 없는 계정입니다.");
    request.user = actor;
    return true;
  }
}
