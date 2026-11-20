import { BadRequestException, Controller, Get, INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request = require("supertest");

import { ObservabilityModule } from "../src/observability/observability.module";

@Controller("probe")
class ProbeController {
  @Get()
  getProbe(): { status: string } {
    return { status: "정상" };
  }

  @Get("error")
  getError(): never {
    throw new BadRequestException({ code: "PROBE_INVALID", message: "점검 요청이 올바르지 않습니다." });
  }
}

describe("관측성 API (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ METRICS_TOKEN: "metrics-test-token" })],
        }),
        ObservabilityModule,
      ],
      controllers: [ProbeController],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => app.close());

  it("요청 ID를 그대로 전달하고 구조화 오류 응답에 포함한다", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/probe/error")
      .set("x-request-id", "launch-check-1")
      .expect(400);

    expect(response.headers["x-request-id"]).toBe("launch-check-1");
    expect(response.body).toEqual({
      code: "PROBE_INVALID",
      message: "점검 요청이 올바르지 않습니다.",
      requestId: "launch-check-1",
    });
  });

  it("메트릭을 토큰으로 보호하고 요청 수와 p95를 내보낸다", async () => {
    await request(app.getHttpServer()).get("/api/v1/probe").expect(200);
    await request(app.getHttpServer()).get("/api/v1/operations/metrics").expect(401);

    const response = await request(app.getHttpServer())
      .get("/api/v1/operations/metrics")
      .set("x-metrics-token", "metrics-test-token")
      .expect(200);

    expect(response.text).toContain("project_hub_http_requests_total");
    expect(response.text).toContain("project_hub_http_duration_p95_ms");
    expect(response.text).not.toContain("metrics-test-token");
  });
});
