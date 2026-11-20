import { Test } from "@nestjs/testing";

const TEST_ENVIRONMENT = {
  DATABASE_URL: "postgresql://project_hub:test@127.0.0.1:5432/project_hub_test",
  REDIS_URL: "redis://127.0.0.1:6379",
  S3_ENDPOINT: "http://127.0.0.1:9000",
  S3_REGION: "ap-northeast-2",
  S3_BUCKET: "project-hub-test",
  S3_ACCESS_KEY: "test-access-key",
  S3_SECRET_KEY: "test-secret-key",
  AUTH_TOKEN_SECRET: "test-auth-token-secret-at-least-32-characters",
};

describe("AppModule 의존성 조립", () => {
  it("모든 기능 모듈의 의존성을 외부 서비스 연결 전까지 해결한다", async () => {
    for (const [key, value] of Object.entries(TEST_ENVIRONMENT)) {
      process.env[key] ??= value;
    }

    const { AppModule } = await import("./app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef.get(AppModule)).toBeInstanceOf(AppModule);
    await moduleRef.close();
  });
});
