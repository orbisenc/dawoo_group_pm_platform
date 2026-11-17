import { type CanActivate, type ExecutionContext, type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request = require("supertest");

import { ApiAuthGuard } from "../src/auth/api-auth.guard";
import { FeedController } from "../src/feed/feed.controller";
import { FeedService } from "../src/feed/feed.service";

const PROJECT_ID = "10000000-0000-4000-8000-000000000001";
const GROUP_ID = "20000000-0000-4000-8000-000000000001";

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    context.switchToHttp().getRequest<{ user?: unknown }>().user = { id: "user-1", isActive: true, platformRole: "USER" };
    return true;
  }
}

describe("그룹 이슈 피드 API 입력 계약 (e2e)", () => {
  let app: INestApplication;
  const create = jest.fn().mockResolvedValue({ id: "post-1" });
  const list = jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FeedController],
      providers: [
        { provide: FeedService, useValue: { create, list } },
      ],
    }).overrideGuard(ApiAuthGuard).useClass(TestAuthGuard).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => app.close());

  it("지원하는 게시글 유형과 상태를 전달한다", async () => {
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_ID}/groups/${GROUP_ID}/feed`).send({
      type: "DECISION", title: "외장재 색상 확정", content: "A안으로 최종 결정합니다.", priority: "HIGH", status: "COMPLETED", tags: ["외장재", "의사결정"],
    }).expect(201);
    expect(create).toHaveBeenCalledWith(expect.anything(), PROJECT_ID, GROUP_ID, expect.objectContaining({ type: "DECISION", status: "COMPLETED" }));
  });

  it("알 수 없는 입력 필드와 잘못된 태그를 거부한다", async () => {
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_ID}/groups/${GROUP_ID}/feed`).send({ type: "ISSUE", title: "검토 요청", content: "내용", role: "CLIENT_ADMIN" }).expect(400);
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_ID}/groups/${GROUP_ID}/feed`).send({ type: "ISSUE", title: "검토 요청", content: "내용", tags: ["<script>"] }).expect(400);
  });

  it("페이지 크기를 50건 이하로 제한한다", async () => {
    await request(app.getHttpServer()).get(`/api/v1/projects/${PROJECT_ID}/groups/${GROUP_ID}/feed?pageSize=100`).expect(400);
  });
});
