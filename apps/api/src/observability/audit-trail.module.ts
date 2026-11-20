import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { AuditTrailInterceptor } from "./audit-trail.interceptor";
import { ObservabilityModule } from "./observability.module";

@Module({
  imports: [ObservabilityModule],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditTrailInterceptor }],
})
export class AuditTrailModule {}
