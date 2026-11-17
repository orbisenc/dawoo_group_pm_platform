import { type CanActivate, type ExecutionContext, type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request = require("supertest");

import { ApprovalController } from "../src/approvals/approval.controller";
import { ApprovalService } from "../src/approvals/approval.service";
import { ApiAuthGuard } from "../src/auth/api-auth.guard";

const PROJECT_ID = "30000000-0000-4000-8000-000000000001";
class TestAuthGuard implements CanActivate { canActivate(context: ExecutionContext) { context.switchToHttp().getRequest<{ user?: unknown }>().user = { id: "user-1", isActive: true, platformRole: "USER" }; return true; } }

describe("기본 전자결재 API 입력 계약 (e2e)", () => {
  let app: INestApplication;
  const create = jest.fn().mockResolvedValue({ id: "approval-1" }); const reject = jest.fn().mockResolvedValue({ id: "approval-1", status: "REJECTED" });
  beforeAll(async () => { const module = await Test.createTestingModule({ controllers: [ApprovalController], providers: [{ provide: ApprovalService, useValue: { create, reject } }] }).overrideGuard(ApiAuthGuard).useClass(TestAuthGuard).compile(); app = module.createNestApplication(); app.setGlobalPrefix("api/v1"); app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })); await app.init(); });
  afterAll(async () => app.close());

  it("문서 버전과 순차 결재선을 지정해 기안한다", async () => {
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_ID}/approvals`).send({ title: "공사 변경 품의", content: "변경 계약 검토 요청", fileId: "50000000-0000-4000-8000-000000000001", fileVersionId: "60000000-0000-4000-8000-000000000001", approverIds: ["20000000-0000-4000-8000-000000000001"] }).expect(201);
    expect(create).toHaveBeenCalledWith(expect.anything(), PROJECT_ID, expect.objectContaining({ approverIds: expect.any(Array) }));
  });

  it("반려 의견과 알 수 없는 권한 필드를 검증한다", async () => {
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_ID}/approvals/70000000-0000-4000-8000-000000000001/reject`).send({ comment: "" }).expect(400);
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_ID}/approvals`).send({ title: "권한 위조", content: "본문", role: "PLATFORM_ADMIN" }).expect(400);
    expect(reject).not.toHaveBeenCalled();
  });
});
