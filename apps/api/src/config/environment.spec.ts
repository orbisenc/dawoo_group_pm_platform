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

  it("Autodesk APS 자격증명은 Client ID와 Secret을 함께 요구한다", () => {
    expect(() => validateEnvironment({ ...validEnvironment, APS_CLIENT_ID: "client-only" })).toThrow(
      "APS_CLIENT_ID와 APS_CLIENT_SECRET은 함께 설정해야 합니다.",
    );
  });

  it("Autodesk APS 버킷 키에 안전한 문자만 허용한다", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      APS_CLIENT_ID: "client",
      APS_CLIENT_SECRET: "secret",
      APS_BUCKET_KEY: "Project Hub Bucket",
    })).toThrow("APS_BUCKET_KEY는 소문자 영문, 숫자, 하이픈으로 구성된 3~128자여야 합니다.");
  });
});
