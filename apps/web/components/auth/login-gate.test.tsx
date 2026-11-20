import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminRegistrations } from "./admin-registrations";
import { AuthProvider, useAuth } from "./auth-context";
import { LoginGate } from "./login-gate";

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

function ProtectedArea() {
  const { logout } = useAuth();
  return <div><h1>보호된 대시보드</h1><AdminRegistrations /><button type="button" onClick={logout}>테스트 로그아웃</button></div>;
}

describe("로그인 및 회원가입 승인 화면", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_TEST_AUTH", "true");
    Object.defineProperty(window, "localStorage", { configurable: true, value: storageMock() });
    Object.defineProperty(window, "sessionStorage", { configurable: true, value: storageMock() });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 502 })));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("로그인 전에는 보호 화면을 숨기고 관리자 로그인 후 표시한다", async () => {
    render(<AuthProvider><LoginGate><ProtectedArea /></LoginGate></AuthProvider>);
    expect(await screen.findByRole("heading", { name: "로그인" })).toBeInTheDocument();
    expect(screen.queryByText("보호된 대시보드")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("아이디"), { target: { value: "dawooadmin" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "123123" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByText("보호된 대시보드")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /가입 승인/ })).toBeInTheDocument();
  });

  it("테스트 인증 플래그가 꺼지면 로컬 관리자 인증으로 우회하지 않는다", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_TEST_AUTH", "false");
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    render(<AuthProvider><LoginGate><ProtectedArea /></LoginGate></AuthProvider>);
    fireEvent.change(await screen.findByLabelText("아이디"), { target: { value: "dawooadmin" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "123123" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다.");
    expect(screen.queryByText("보호된 대시보드")).not.toBeInTheDocument();
  });

  it("회원가입 신청은 관리자 승인 전 로그인을 막고 승인 후 허용한다", async () => {
    render(<AuthProvider><LoginGate><ProtectedArea /></LoginGate></AuthProvider>);
    await screen.findByRole("heading", { name: "로그인" });
    fireEvent.click(screen.getByRole("button", { name: "회원가입 신청" }));
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "홍길동" } });
    fireEvent.change(screen.getByLabelText("아이디"), { target: { value: "honggildong" } });
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "hong@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "secure123" } });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), { target: { value: "secure123" } });
    fireEvent.click(screen.getByRole("button", { name: "회원가입 신청" }));
    expect(await screen.findByText(/관리자 승인 후 로그인/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "secure123" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("관리자 승인 대기 중");

    fireEvent.change(screen.getByLabelText("아이디"), { target: { value: "dawooadmin" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "123123" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByText("보호된 대시보드")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /가입 승인/ }));
    expect(await screen.findByText("@honggildong · hong@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    await waitFor(() => expect(screen.queryByText("@honggildong · hong@example.com")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "회원가입 승인 창 닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "테스트 로그아웃" }));
    fireEvent.change(await screen.findByLabelText("아이디"), { target: { value: "honggildong" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "secure123" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByText("보호된 대시보드")).toBeInTheDocument();
  });
});
