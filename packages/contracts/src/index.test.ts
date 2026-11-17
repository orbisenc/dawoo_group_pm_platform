import { describe, expect, it } from "vitest";

import { isApiHealthResponse } from "./index";

describe("isApiHealthResponse", () => {
  it("정상적인 API 상태 응답을 판별한다", () => {
    expect(
      isApiHealthResponse({
        service: "PROJECT HUB API",
        status: "정상",
        version: "0.1.0",
        timestamp: "2026-10-28T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("잘못된 응답을 거부한다", () => {
    expect(isApiHealthResponse({ status: "ok" })).toBe(false);
  });
});
