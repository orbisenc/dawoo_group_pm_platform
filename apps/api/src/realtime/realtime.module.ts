import { Module } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { AuthTokenService } from "../auth/auth-token.service";
import { CollaborationModule } from "../projects/collaboration.module";
import { CollaborationRepository } from "../projects/collaboration.types";
import { PrismaCollaborationRepository } from "../projects/prisma-collaboration.repository";
import { NotificationController } from "./notification.controller";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";

@Module({
  imports: [CollaborationModule],
  controllers: [NotificationController],
  providers: [RealtimeService, RealtimeGateway, ApiAuthGuard, AuthTokenService, PrismaCollaborationRepository, { provide: CollaborationRepository, useExisting: PrismaCollaborationRepository }],
  exports: [RealtimeService],
})
export class RealtimeModule {}
