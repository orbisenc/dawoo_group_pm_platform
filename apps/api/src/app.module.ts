import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { validateEnvironment } from "./config/environment";
import { HealthModule } from "./health/health.module";
import { InfrastructureModule } from "./infrastructure/infrastructure.module";
import { CollaborationModule } from "./projects/collaboration.module";
import { FeedModule } from "./feed/feed.module";
import { AuthModule } from "./auth/auth.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { DriveModule } from "./drive/drive.module";
import { CalendarModule } from "./calendar/calendar.module";
import { ApprovalModule } from "./approvals/approval.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { ObservabilityModule } from "./observability/observability.module";
import { AuditTrailModule } from "./observability/audit-trail.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
      validate: validateEnvironment,
    }),
    InfrastructureModule,
    CollaborationModule,
    FeedModule,
    AuthModule,
    RealtimeModule,
    DriveModule,
    CalendarModule,
    ApprovalModule,
    DashboardModule,
    HealthModule,
    ObservabilityModule,
    AuditTrailModule,
  ],
})
export class AppModule {}
