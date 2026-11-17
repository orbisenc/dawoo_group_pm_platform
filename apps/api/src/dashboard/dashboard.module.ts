import { Module } from "@nestjs/common";

import { CollaborationModule } from "../projects/collaboration.module";
import { DriveModule } from "../drive/drive.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [CollaborationModule, DriveModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
