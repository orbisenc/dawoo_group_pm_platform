import { ConfigService } from "@nestjs/config";

import { AuthTokenService } from "./auth-token.service";

describe("AuthTokenService", () => {
  const service = new AuthTokenService(new ConfigService({ AUTH_TOKEN_SECRET: "unit-test-secret" }));

  it("서명된 만료 전 토큰에서 사용자 ID를 검증한다", () => {
    const token = service.sign("user-1", 60);
    expect(service.verify(token)).toBe("user-1");
  });

  it("변조되거나 만료된 토큰을 거부한다", () => {
    const token = service.sign("user-1", 60);
    expect(service.verify(`${token}tampered`)).toBeNull();
    expect(service.verify(service.sign("user-1", -1))).toBeNull();
  });
});
