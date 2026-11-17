import { validateEnvironment } from "./environment";

const validEnvironment = {
  DATABASE_URL: "postgresql://localhost/project_hub",
  REDIS_URL: "redis://localhost:6379",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "ap-northeast-2",
  S3_BUCKET: "project-hub-local",
  S3_ACCESS_KEY: "local",
  S3_SECRET_KEY: "local-secret",
  AUTH_TOKEN_SECRET: "test-auth-secret",
};

describe("validateEnvironment", () => {
  it("필수 환경변수가 있으면 기본 API 포트를 적용한다", () => {
    expect(validateEnvironment(validEnvironment).API_PORT).toBe("4000");
  });

  it("필수 환경변수가 없으면 한국어 오류를 반환한다", () => {
    expect(() => validateEnvironment({})).toThrow("필수 환경변수가 없습니다");
  });

  it("잘못된 포트를 거부한다", () => {
    expect(() => validateEnvironment({ ...validEnvironment, API_PORT: "70000" })).toThrow(
      "API_PORT는 1부터 65535 사이의 정수여야 합니다.",
    );
  });
});
