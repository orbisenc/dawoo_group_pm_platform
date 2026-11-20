import { Module } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { AuthTokenService } from "../auth/auth-token.service";
import { CollaborationController } from "./collaboration.controller";
import { CollaborationRepository } from "./collaboration.types";
import { PrismaCollaborationRepository } from "./prisma-collaboration.repository";
import { ProjectAccessPolicy } from "./project-access.policy";
import { CollaborationService } from "./collaboration.service";

@Module({
  controllers: [CollaborationController],
  providers: [
    ApiAuthGuard,
    AuthTokenService,
    ProjectAccessPolicy,
    CollaborationService,
    PrismaCollaborationRepository,
    { provide: CollaborationRepository, useExisting: PrismaCollaborationRepository },
  ],
  exports: [
    CollaborationService,
    CollaborationRepository,
    AuthTokenService,
    ApiAuthGuard,
  ],
})
export class CollaborationModule {}
