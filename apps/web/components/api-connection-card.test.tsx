import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiConnectionCard } from "./api-connection-card";

describe("ApiConnectionCard", () => {
  afterEach(() => vi.restoreAllMocks());

  it("NestJS API 연결 성공 상태를 한국어로 표시한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          service: "PROJECT HUB API",
          status: "정상",
          version: "0.1.0",
          timestamp: "2026-10-28T01:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<ApiConnectionCard />);

    await waitFor(() => {
      expect(screen.getByText("PROJECT HUB API 정상 작동 중")).toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith("/backend/health", { cache: "no-store" });
  });

  it("연결 실패 안내를 표시한다", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("연결 실패"));

    render(<ApiConnectionCard />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "API에 연결할 수 없습니다. 백엔드 실행 상태를 확인해 주세요.",
    );
  });
});
