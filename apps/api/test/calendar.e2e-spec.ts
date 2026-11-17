import { type CanActivate, type ExecutionContext, type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request = require("supertest");

import { ApiAuthGuard } from "../src/auth/api-auth.guard";
import { CalendarController } from "../src/calendar/calendar.controller";
import { CalendarService } from "../src/calendar/calendar.service";

const PROJECT_ID = "30000000-0000-4000-8000-000000000001";
class TestAuthGuard implements CanActivate { canActivate(context: ExecutionContext) { context.switchToHttp().getRequest<{ user?: unknown }>().user = { id: "user-1", isActive: true, platformRole: "USER" }; return true; } }

describe("프로젝트 캘린더 API 입력 계약 (e2e)", () => {
  let app: INestApplication; const create = jest.fn().mockResolvedValue({ id: "event-1" }); const list = jest.fn().mockResolvedValue({ items: [] });
  beforeAll(async () => { const module = await Test.createTestingModule({ controllers: [CalendarController], providers: [{ provide: CalendarService, useValue: { create, list } }] }).overrideGuard(ApiAuthGuard).useClass(TestAuthGuard).compile(); app = module.createNestApplication(); app.setGlobalPrefix("api/v1"); app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })); await app.init(); });
  afterAll(async () => app.close());

  it("사용자 정의 마일스톤과 참여자를 전달한다", async () => {
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_ID}/calendar`).send({ kind: "MILESTONE", title: "브릿지론 상환", milestoneName: "브릿지론 상환", startsAt: "2026-11-10T00:00:00.000Z", endsAt: "2026-11-11T00:00:00.000Z", participantIds: ["20000000-0000-4000-8000-000000000001"], reminderMinutes: 1440 }).expect(201);
    expect(create).toHaveBeenCalledWith(expect.anything(), PROJECT_ID, expect.objectContaining({ kind: "MILESTONE", milestoneName: "브릿지론 상환" }));
  });

  it("조회 범위와 허용되지 않은 입력을 검증한다", async () => {
    await request(app.getHttpServer()).get(`/api/v1/projects/${PROJECT_ID}/calendar?from=invalid&to=2026-12-01T00:00:00.000Z`).expect(400);
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_ID}/calendar`).send({ kind: "FIXED", title: "잘못된 일정", startsAt: "2026-11-10T00:00:00.000Z", endsAt: "2026-11-11T00:00:00.000Z", projectRole: "CLIENT_ADMIN" }).expect(400);
  });
});
