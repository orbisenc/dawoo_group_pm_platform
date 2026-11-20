import { Injectable, Logger, type NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { MetricsService } from "./metrics.service";
import { RequestContextService } from "./request-context.service";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

@Injectable()
export class RequestObservabilityMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HttpRequest");

  constructor(
    private readonly context: RequestContextService,
    private readonly metrics: MetricsService,
  ) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const supplied = request.header("x-request-id");
    const requestId = supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();
    const startedAt = process.hrtime.bigint();
    response.setHeader("x-request-id", requestId);

    this.context.run(requestId, () => {
      response.once("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        this.metrics.record(request.method, request.path, response.statusCode, durationMs);
        this.logger.log(
          JSON.stringify({
            type: "http_request",
            requestId,
            method: request.method,
            path: request.path,
            statusCode: response.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
          }),
        );
      });
      next();
    });
  }
}
