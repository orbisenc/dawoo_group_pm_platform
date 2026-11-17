import { Module } from "@nestjs/common";

import { AuthTokenService } from "./auth-token.service";
import { DevAuthController } from "./dev-auth.controller";

@Module({ controllers: [DevAuthController], providers: [AuthTokenService] })
export class AuthModule {}
