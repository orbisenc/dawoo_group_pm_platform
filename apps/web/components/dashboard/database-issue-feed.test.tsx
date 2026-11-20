import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseIssueFeed } from "./database-issue-feed";

vi.mock("socket.io-client", () => ({
  io: () => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }),
}));

describe("DatabaseIssueFeed", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        key: (index: number) => [...values.keys()][index] ?? null,
        get length() {
          return values.size;
        },
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("개발 세션으로 DB 피드를 조회해 게시글을 표시한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "signed-token" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "post-1",
                type: "ISSUE",
                title: "DB 저장 이슈",
                content: "새로고침 후에도 유지됩니다.",
                priority: "HIGH",
                status: "UNDER_REVIEW",
                tags: ["bim"],
                author: { name: "김지훈" },
                attachments: [],
                _count: { comments: 1 },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<DatabaseIssueFeed />);

    expect(await screen.findByText("DB 저장 이슈")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/feed?"),
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: "Bearer signed-token",
          }),
        }),
      ),
    );
  });

  it("API가 꺼져 있어도 로컬 저장 모드에서 게시글을 작성하고 유지한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 502 })),
    );
    render(<DatabaseIssueFeed />);

    expect(await screen.findByText("로컬 저장 모드")).toBeInTheDocument();
    expect(await screen.findByText("조건에 맞는 게시글이 없습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "＋ 새 게시글" }));
    fireEvent.change(screen.getByLabelText("게시글 제목"), {
      target: { value: "로컬 현장 확인 요청" },
    });
    fireEvent.change(screen.getByLabelText("게시글 내용"), {
      target: { value: "API 없이도 저장되는 게시글입니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "게시글 등록" }));

    expect(await screen.findByText("로컬 현장 확인 요청")).toBeInTheDocument();
    expect(
      window.localStorage.getItem(
        "project-hub:group-feed:v4:30000000-0000-4000-8000-000000000001:40000000-0000-4000-8000-000000000001",
      ),
    ).toContain("로컬 현장 확인 요청");
  });
});
