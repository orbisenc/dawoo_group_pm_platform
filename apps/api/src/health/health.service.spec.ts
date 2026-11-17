import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("한국어 정상 상태를 반환한다", () => {
    const result = new HealthService().getHealth();

    expect(result.service).toBe("PROJECT HUB API");
    expect(result.status).toBe("정상");
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
