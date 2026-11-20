import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";

import { RequestContextService } from "./request-context.service";

type HttpExceptionBody = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ApiException");

  constructor(private readonly context: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = this.context.getRequestId() ?? String(response.getHeader("x-request-id") ?? "unknown");
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = this.getExceptionBody(exception);
    const code = typeof body.code === "string" ? body.code : this.defaultCode(status);
    const details = body.details ?? (Array.isArray(body.message) ? body.message : undefined);
    const message = this.safeMessage(status, body.message);

    const log = JSON.stringify({
      type: "api_error",
      requestId,
      method: request.method,
      path: request.path,
      statusCode: status,
      code,
    });
    if (status >= 500) this.logger.error(log, exception instanceof Error ? exception.stack : undefined);
    else this.logger.warn(log);

    response.status(status).json({ code, message, details, requestId });
  }

  private getExceptionBody(exception: unknown): HttpExceptionBody {
    if (!(exception instanceof HttpException)) return {};
    const response = exception.getResponse();
    return typeof response === "string" ? { message: response } : (response as HttpExceptionBody);
  }

  private safeMessage(status: number, value: unknown): string {
    if (status >= 500) return "일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      return "입력값을 확인해 주세요.";
    }
    return status === 404
      ? "요청한 정보를 찾을 수 없습니다."
      : "요청을 처리할 수 없습니다.";
  }

  private defaultCode(status: number): string {
    const names: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "UNPROCESSABLE_ENTITY",
      429: "TOO_MANY_REQUESTS",
      503: "SERVICE_UNAVAILABLE",
    };
    return names[status] ?? (status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED");
  }
}
