import { Global, MiddlewareConsumer, Module, RequestMethod, type NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { ApiExceptionFilter } from "./api-exception.filter";
import { MetricsService } from "./metrics.service";
import { OperationsController } from "./operations.controller";
import { RequestContextService } from "./request-context.service";
import { RequestObservabilityMiddleware } from "./request-observability.middleware";

@Global()
@Module({
  controllers: [OperationsController],
  providers: [
    MetricsService,
    RequestContextService,
    RequestObservabilityMiddleware,
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
  exports: [MetricsService, RequestContextService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestObservabilityMiddleware).forRoutes({ path: "{*path}", method: RequestMethod.ALL });
  }
}
