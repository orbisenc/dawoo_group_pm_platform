import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request = require("supertest");

import { HealthController } from "../src/health/health.controller";
import { HealthService } from "../src/health/health.service";
import { InfrastructureService } from "../src/infrastructure/infrastructure.service";

describe("상태 확인 API (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: InfrastructureService,
          useValue: {
            checkDependencies: () =>
              Promise.resolve({
                database: "정상",
                redis: "정상",
                objectStorage: "정상",
              }),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => app.close());

  it("GET /api/v1/health", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    expect(response.body).toMatchObject({ service: "PROJECT HUB API", status: "정상" });
  });

  it("GET /api/v1/health/ready", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health/ready").expect(200);
    expect(response.body.dependencies).toEqual({
      database: "정상",
      redis: "정상",
      objectStorage: "정상",
    });
  });
});
