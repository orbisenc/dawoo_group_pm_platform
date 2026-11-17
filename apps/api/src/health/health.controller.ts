import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";

import type { ApiHealthResponse, ApiReadinessResponse } from "@project-hub/contracts";

import { InfrastructureService } from "../infrastructure/infrastructure.service";
import { HealthService } from "./health.service";

@ApiTags("상태 확인")
@Controller("health")
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly infrastructure: InfrastructureService,
  ) {}

  @Get()
  @ApiOperation({ summary: "API 생존 상태 확인" })
  @ApiOkResponse({ description: "API가 요청을 처리할 수 있습니다." })
  getHealth(): ApiHealthResponse {
    return this.healthService.getHealth();
  }

  @Get("ready")
  @ApiOperation({ summary: "PostgreSQL, Redis, S3 준비 상태 확인" })
  @ApiOkResponse({ description: "모든 기반 서비스가 준비되었습니다." })
  @ApiServiceUnavailableResponse({ description: "하나 이상의 기반 서비스에 연결할 수 없습니다." })
  async getReadiness(): Promise<ApiReadinessResponse> {
    const dependencies = await this.infrastructure.checkDependencies();
    const response = { ...this.healthService.getHealth(), dependencies };

    if (Object.values(dependencies).some((state) => state === "오류")) {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }
}
