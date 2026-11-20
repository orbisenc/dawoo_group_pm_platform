import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuthProvider } from "../auth/auth-context";
import { NotificationCenter } from "./notification-center";

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

const localUser = {
  id: "local-admin",
  username: "dawooadmin",
  email: "admin@projecthub.local",
  name: "다우그룹 관리자",
  platformRole: "PLATFORM_ADMIN",
};

describe("상단 알림 센터", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", { configurable: true, value: storageMock() });
    Object.defineProperty(window, "sessionStorage", { configurable: true, value: storageMock() });
    window.localStorage.clear();
    window.sessionStorage.setItem("project-hub-access-token", "local:local-admin");
    window.sessionStorage.setItem("project-hub-session-user", JSON.stringify(localUser));
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("읽지 않은 알림을 표시하고 모두 읽음 처리한다", async () => {
    render(
      <AuthProvider>
        <NotificationCenter />
      </AuthProvider>,
    );

    const trigger = await screen.findByRole("button", { name: "읽지 않은 알림 3개" });
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "알림 목록" })).toBeInTheDocument();
    expect(screen.getByText("의왕 학의지구 수익성 민감도 검토 의견이 요청되었습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "모두 읽음" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "읽지 않은 알림 0개" })).toBeInTheDocument());
    expect(screen.getByText("새로운 알림이 없습니다.")).toBeInTheDocument();
  });
});
