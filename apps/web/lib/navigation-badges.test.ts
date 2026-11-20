import { beforeEach, describe, expect, it } from "vitest";

import { countUnreadIssues, markNavigationSectionSeen, readSeenAt } from "./navigation-badges";

function storageMock() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

describe("내비게이션 미확인 배지", () => {
  beforeEach(() => {
    Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
    Object.defineProperty(window, "localStorage", { configurable: true, value: storageMock() });
  });

  it("새 이슈만 집계하고 확인 시점을 저장한다", async () => {
    window.localStorage.setItem("project-hub-issue-feed-v2", JSON.stringify({
      version: 1,
      projects: {
        "project-1": [
          { createdAt: "2026-11-20T01:00:00.000Z", deletedAt: null },
          { createdAt: "2026-11-20T02:00:00.000Z", deletedAt: null },
          { createdAt: "2026-11-20T03:00:00.000Z", deletedAt: "2026-11-20T04:00:00.000Z" },
        ],
      },
    }));

    expect(await countUnreadIssues("project-1", "2026-11-20T01:30:00.000Z")).toBe(1);
    markNavigationSectionSeen("issues", "user-1", "project-1");
    expect(readSeenAt("issues", "user-1", "project-1")).not.toBe("");
  });
});
