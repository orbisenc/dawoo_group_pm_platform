import {
  Controller,
  Get,
  Headers,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";

import { MetricsService } from "./metrics.service";

@ApiExcludeController()
@Controller("operations")
export class OperationsController {
  constructor(
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  @Get("metrics")
  getMetrics(@Headers("x-metrics-token") suppliedToken?: string): string {
    const expectedToken = this.config.get<string>("METRICS_TOKEN")?.trim();
    if (!expectedToken) {
      throw new ServiceUnavailableException("메트릭 접근 토큰이 설정되지 않았습니다.");
    }
    if (!suppliedToken || suppliedToken !== expectedToken) {
      throw new UnauthorizedException("메트릭 접근 권한이 없습니다.");
    }
    return this.metrics.renderPrometheus();
  }
}
