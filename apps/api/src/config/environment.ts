const requiredKeys = [
  "DATABASE_URL",
  "REDIS_URL",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "AUTH_TOKEN_SECRET",
] as const;

type Environment = Record<string, string | undefined>;

export function validateEnvironment(environment: Environment): Environment {
  const missing = requiredKeys.filter((key) => !environment[key]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `필수 환경변수가 없습니다: ${missing.join(", ")}. 루트의 .env.example을 .env로 복사해 주세요.`,
    );
  }

  const apiPort = Number(environment.API_PORT ?? "4000");
  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
    throw new Error("API_PORT는 1부터 65535 사이의 정수여야 합니다.");
  }

  const apsClientId = environment.APS_CLIENT_ID?.trim();
  const apsClientSecret = environment.APS_CLIENT_SECRET?.trim();
  if (Boolean(apsClientId) !== Boolean(apsClientSecret)) {
    throw new Error("APS_CLIENT_ID와 APS_CLIENT_SECRET은 함께 설정해야 합니다.");
  }

  const apsBucketKey = environment.APS_BUCKET_KEY?.trim();
  if (apsBucketKey && !/^[a-z0-9][a-z0-9-]{1,126}[a-z0-9]$/.test(apsBucketKey)) {
    throw new Error("APS_BUCKET_KEY는 소문자 영문, 숫자, 하이픈으로 구성된 3~128자여야 합니다.");
  }

  return { ...environment, API_PORT: String(apiPort) };
}
