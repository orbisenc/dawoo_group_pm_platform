import { Module } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { AuthTokenService } from "../auth/auth-token.service";
import { InputSecurityService } from "../feed/input-security.service";
import { CollaborationModule } from "../projects/collaboration.module";
import { DriveController } from "./drive.controller";
import { DriveService } from "./drive.service";

@Module({
  imports: [CollaborationModule],
  controllers: [DriveController],
  providers: [DriveService, InputSecurityService, ApiAuthGuard, AuthTokenService],
  exports: [DriveService],
})
export class DriveModule {}
