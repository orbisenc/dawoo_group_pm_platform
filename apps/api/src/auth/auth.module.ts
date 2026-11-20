import { Module } from "@nestjs/common";

import { AuthTokenService } from "./auth-token.service";
import { ApiAuthGuard } from "./api-auth.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { DevAuthController } from "./dev-auth.controller";
import { PasswordHashService } from "./password-hash.service";
import { GoogleDriveInvitationProcessor } from "./google-drive-invitation.processor";
import { GoogleDriveInvitationService } from "./google-drive-invitation.service";
import { CollaborationRepository } from "../projects/collaboration.types";
import { PrismaCollaborationRepository } from "../projects/prisma-collaboration.repository";

@Module({
  controllers: [AuthController, DevAuthController],
  providers: [
    AuthService,
    AuthTokenService,
    PasswordHashService,
    GoogleDriveInvitationService,
    GoogleDriveInvitationProcessor,
    ApiAuthGuard,
    PrismaCollaborationRepository,
    { provide: CollaborationRepository, useExisting: PrismaCollaborationRepository },
  ],
})
export class AuthModule {}
