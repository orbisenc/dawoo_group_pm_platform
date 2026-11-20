import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";

import { AuditTrailInterceptor } from "./audit-trail.interceptor";

const actorId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const fileId = "33333333-3333-4333-8333-333333333333";

describe("AuditTrailInterceptor", () => {
  it("성공한 프로젝트 파일 다운로드를 요청 본문 없이 감사 로그로 남긴다", async () => {
    const create = jest.fn().mockResolvedValue({});
    const interceptor = new AuditTrailInterceptor(
      { auditLog: { create } } as never,
      { getRequestId: () => "request-1" } as never,
    );
    const context = httpContext({
      method: "GET",
      originalUrl: `/api/v1/projects/${projectId}/drive/files/${fileId}/download`,
      params: { projectId, fileId },
      user: { id: actorId },
    });

    await lastValueFrom(interceptor.intercept(context, handler({ url: "signed" })));

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId,
        projectId,
        resourceId: fileId,
        resourceType: "DriveFile",
        action: "FILE_DOWNLOADED",
        requestId: "request-1",
        summary: { method: "GET", route: "/api/v1/projects/:id/drive/files/:id/download" },
      }),
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain("signed");
  });

  it("조회 요청과 기존 트랜잭션 감사 대상인 결재 요청은 중복 기록하지 않는다", async () => {
    const create = jest.fn();
    const interceptor = new AuditTrailInterceptor(
      { auditLog: { create } } as never,
      { getRequestId: () => "request-2" } as never,
    );

    await lastValueFrom(interceptor.intercept(httpContext({
      method: "GET",
      originalUrl: `/api/v1/projects/${projectId}`,
      params: { projectId },
      user: { id: actorId },
    }), handler({ id: projectId })));
    await lastValueFrom(interceptor.intercept(httpContext({
      method: "POST",
      originalUrl: `/api/v1/projects/${projectId}/approvals`,
      params: { projectId },
      user: { id: actorId },
    }), handler({ id: fileId })));

    expect(create).not.toHaveBeenCalled();
  });
});

function httpContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => "http",
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function handler(response: unknown): CallHandler {
  return { handle: () => of(response) };
}
