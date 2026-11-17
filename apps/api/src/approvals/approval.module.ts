import { Module } from "@nestjs/common";

import { CollaborationModule } from "../projects/collaboration.module";
import { DriveModule } from "../drive/drive.module";
import { InputSecurityService } from "../feed/input-security.service";
import { ApprovalController } from "./approval.controller";
import { ApprovalService } from "./approval.service";

@Module({ imports: [CollaborationModule, DriveModule], controllers: [ApprovalController], providers: [ApprovalService, InputSecurityService], exports: [ApprovalService] })
export class ApprovalModule {}
