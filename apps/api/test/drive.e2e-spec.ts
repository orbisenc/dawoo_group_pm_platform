import { type CanActivate, type ExecutionContext, type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request = require("supertest");

import { ApiAuthGuard } from "../src/auth/api-auth.guard";
import { DriveController } from "../src/drive/drive.controller";
import { DriveService } from "../src/drive/drive.service";

const PROJECT_ID = "30000000-0000-4000-8000-000000000001";
class TestAuthGuard implements CanActivate { canActivate(context: ExecutionContext) { context.switchToHttp().getRequest<{ user?: unknown }>().user = { id: "user-1", isActive: true, platformRole: "USER" }; return true; } }

describe("프로젝트 공유 드라이브 API 입력 계약 (e2e)", () => {
  let app: INestApplication;
  const list = jest.fn().mockResolvedValue({ folders: [], files: [] });
  const createFolder = jest.fn().mockResolvedValue({ id: "folder-1" });
  const prepareFile = jest.fn().mockResolvedValue({ file: { id: "file-1" } });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [DriveController], providers: [{ provide: DriveService, useValue: { list, createFolder, prepareFile } }] }).overrideGuard(ApiAuthGuard).useClass(TestAuthGuard).compile();
    app = module.createNestApplication(); app.setGlobalPrefix("api/v1"); app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })); await app.init();
  });
  afterAll(async () => app.close());

  it("폴더를 생성하고 프로젝트 범위를 서비스에 전달한다", async () => {
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_ID}/drive/folders`).send({ name: "설계도서", isRestricted: true }).expect(201);
    expect(createFolder).toHaveBeenCalledWith(expect.anything(), PROJECT_ID, expect.objectContaining({ name: "설계도서", isRestricted: true }));
  });

  it("1GB 초과 파일과 알 수 없는 권한 필드를 거부한다", async () => {
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_ID}/drive/files/prepare`).send({ originalName: "대용량.ifc", mimeType: "application/octet-stream", size: 1073741825 }).expect(400);
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_ID}/drive/folders`).send({ name: "계약", role: "CLIENT_ADMIN" }).expect(400);
  });

  it("잘못된 상위 폴더 식별자를 거부한다", () => request(app.getHttpServer()).get(`/api/v1/projects/${PROJECT_ID}/drive?parentId=other-project-folder`).expect(400));

  it("그룹 접근 권한과 이슈 연결 입력을 검증한다", async () => {
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_ID}/drive/folders`).send({ name: "금융자료", groupIds: ["not-a-uuid"] }).expect(400);
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_ID}/drive/files/11111111-1111-4111-8111-111111111111/issues`).send({ postId: "not-a-uuid" }).expect(400);
  });
});
