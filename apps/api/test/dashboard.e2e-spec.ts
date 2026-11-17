import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request = require("supertest");

import { ApiAuthGuard } from "../src/auth/api-auth.guard";
import { DashboardController } from "../src/dashboard/dashboard.controller";
import { DashboardService } from "../src/dashboard/dashboard.service";

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    context.switchToHttp().getRequest<{ user?: unknown }>().user = {
      id: "user-1",
      isActive: true,
      platformRole: "USER",
    };
    return true;
  }
}

describe("통합 대시보드 API 계약 (e2e)", () => {
  let app: INestApplication;
  const getDashboard = jest
    .fn()
    .mockResolvedValue({ projects: [], myIssues: [] });
  const search = jest.fn().mockResolvedValue({ query: "설계", items: [] });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: { getDashboard, search } },
      ],
    })
      .overrideGuard(ApiAuthGuard)
      .useClass(TestAuthGuard)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => app.close());

  it("인증 사용자 대시보드를 조회한다", async () => {
    await request(app.getHttpServer()).get("/api/v1/dashboard").expect(200);
    expect(getDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1" }),
      undefined,
    );
  });

  it("선택한 프로젝트 ID를 대시보드 범위로 전달한다", async () => {
    const projectId = "30000000-0000-4000-8000-000000000001";
    await request(app.getHttpServer())
      .get(`/api/v1/dashboard?projectId=${projectId}`)
      .expect(200);
    expect(getDashboard).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "user-1" }),
      projectId,
    );
  });

  it("두 글자 미만 검색과 알 수 없는 권한 필드를 거부한다", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/search?query=설")
      .expect(400);
    await request(app.getHttpServer())
      .get("/api/v1/search?query=설계&role=PLATFORM_ADMIN")
      .expect(400);
    expect(search).not.toHaveBeenCalled();
  });
});
