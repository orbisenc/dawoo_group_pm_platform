import { Injectable } from "@nestjs/common";

import type { ApiHealthResponse } from "@project-hub/contracts";

@Injectable()
export class HealthService {
  getHealth(): ApiHealthResponse {
    return {
      service: "PROJECT HUB API",
      status: "정상",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    };
  }
}
