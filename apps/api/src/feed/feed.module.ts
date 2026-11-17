import { Module } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { AuthTokenService } from "../auth/auth-token.service";
import { CollaborationModule } from "../projects/collaboration.module";
import { CollaborationRepository } from "../projects/collaboration.types";
import { PrismaCollaborationRepository } from "../projects/prisma-collaboration.repository";
import { FeedController } from "./feed.controller";
import { FeedService } from "./feed.service";
import { InputSecurityService } from "./input-security.service";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [CollaborationModule, RealtimeModule],
  controllers: [FeedController],
  providers: [
    FeedService,
    InputSecurityService,
    ApiAuthGuard,
    AuthTokenService,
    PrismaCollaborationRepository,
    { provide: CollaborationRepository, useExisting: PrismaCollaborationRepository },
  ],
})
export class FeedModule {}
