import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApprovalWorkspace,
  CalendarWorkspace,
  DriveWorkspace,
} from "./functional-workspaces";
import { AuthProvider } from "../auth/auth-context";
import { ProjectProvider } from "./project-context";

const renderCalendar = () =>
  render(
    <ProjectProvider>
      <CalendarWorkspace />
    </ProjectProvider>,
  );

const renderApproval = () =>
  render(
    <ProjectProvider>
      <ApprovalWorkspace />
    </ProjectProvider>,
  );

describe("기능형 업무 화면", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear(),
      },
    });
    const sessionValues = new Map<string, string>();
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => sessionValues.get(key) ?? null,
        setItem: (key: string, value: string) => sessionValues.set(key, value),
        removeItem: (key: string) => sessionValues.delete(key),
        clear: () => sessionValues.clear(),
      },
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      if (url.includes("/auth/dev-session")) return new Response(JSON.stringify({ accessToken: "signed-token", user: { id: "20000000-0000-4000-8000-000000000002", name: "박민수" } }), { status: 201 });
      if (url.includes("/approvals/context")) return new Response(JSON.stringify({ files: [], members: [
        { user: { id: "20000000-0000-4000-8000-000000000002", name: "박민수" }, role: "PARTICIPANT", projectMember: true },
        { user: { id: "20000000-0000-4000-8000-000000000003", name: "김승인" }, role: "APPROVED_USER", projectMember: false },
      ] }), { status: 200 });
      if (url.includes("/approvals/route-templates")) return new Response(JSON.stringify(options?.method === "POST" ? { id: "template-1" } : []), { status: options?.method === "POST" ? 201 : 200 });
      if (url.includes("/approvals?scope=all")) return new Response(JSON.stringify({ items: [] }), { status: 200 });
      return new Response(JSON.stringify({ message: "테스트에서 처리하지 않은 요청입니다." }), { status: 404 });
    }));
  });
  it("예시 저장소 없이 Google Drive 연결만 제공한다", () => {
    render(<DriveWorkspace />);

    expect(
      screen.getByRole("heading", { name: "Google Drive 연동 준비" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("NEXT_PUBLIC_GOOGLE_CLIENT_ID"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "PROJECT HUB" })).not.toBeInTheDocument();
    expect(screen.queryByText("01_사업관리")).not.toBeInTheDocument();
  });

  it("일정 탭에 통합 대시보드와 같은 Teamup 캘린더를 표시한다", () => {
    renderCalendar();

    expect(
      screen.getByRole("heading", { name: "프로젝트 주요 일정" }),
    ).toBeInTheDocument();
    const calendar = screen.getByTitle(/Teamup 주요 일정/);
    expect(calendar).toHaveAttribute(
      "src",
      expect.stringContaining("teamup.com/ks27cco3hv5g1ove7k"),
    );
    expect(
      screen.getByRole("link", { name: "Teamup에서 열기" }),
    ).toHaveAttribute("href", "https://teamup.com/ks27cco3hv5g1ove7k");
  });

  it("일정 탭의 Teamup 캘린더를 확대하고 복원한다", () => {
    renderCalendar();

    fireEvent.click(screen.getByRole("button", { name: /크게 보기/ }));
    expect(screen.getByRole("button", { name: /원래 크기/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: /원래 크기/ }));
    expect(screen.getByRole("button", { name: /크게 보기/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("예시 결재 없이 실제 API의 빈 상태를 표시한다", async () => {
    renderApproval();
    expect(await screen.findByText("표시할 결재 문서가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("커튼월 업체 선정 품의")).not.toBeInTheDocument();
  });

  it("결재선 템플릿을 결재 문서와 분리해 생성한다", async () => {
    renderApproval();
    await screen.findByText("표시할 결재 문서가 없습니다.");
    fireEvent.click(screen.getByRole("button", { name: /결재선 템플릿/ }));
    fireEvent.click(screen.getByRole("button", { name: "새 결재선 만들기" }));
    expect(screen.getByRole("option", { name: "박민수" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "김승인" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("템플릿 이름"), { target: { value: "기본 공사비 결재선" } });
    fireEvent.change(screen.getByLabelText("결재자 선택"), { target: { value: "20000000-0000-4000-8000-000000000002" } });
    fireEvent.click(screen.getByRole("button", { name: "+ 결재 단계 추가" }));
    fireEvent.change(screen.getByLabelText("결재자 선택"), { target: { value: "20000000-0000-4000-8000-000000000003" } });
    fireEvent.click(screen.getByRole("button", { name: "+ 결재 단계 추가" }));
    expect(screen.getByLabelText("1차 결재 담당자")).toHaveValue("20000000-0000-4000-8000-000000000002");
    expect(screen.getByLabelText("2차 결재 담당자")).toHaveValue("20000000-0000-4000-8000-000000000003");
    fireEvent.click(screen.getByRole("button", { name: "김승인 결재 순서를 앞으로 이동" }));
    expect(screen.getByLabelText("1차 결재 담당자")).toHaveValue("20000000-0000-4000-8000-000000000003");
    fireEvent.click(screen.getByRole("button", { name: "템플릿 저장" }));
    await waitFor(() =>
      expect(screen.getByText("결재선 템플릿을 만들었습니다.")).toBeInTheDocument(),
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(expect.stringContaining("/approvals/route-templates"), expect.objectContaining({ method: "POST" }));
  });

  it("로컬 승인 계정을 결재자 목록에 표시하고 템플릿을 저장한다", async () => {
    window.localStorage.setItem("project-hub-local-accounts", JSON.stringify([
      {
        id: "local-approved-test1",
        username: "test1",
        email: "test1@example.com",
        name: "김지훈test1",
        passwordHash: "hash",
        approvalStatus: "APPROVED",
        platformRole: "USER",
        createdAt: "2026-11-20T00:00:00.000Z",
        approvedAt: "2026-11-20T01:00:00.000Z",
        approvedById: "local-admin",
      },
    ]));
    window.sessionStorage.setItem("project-hub-access-token", "local:local-admin");
    window.sessionStorage.setItem("project-hub-session-user", JSON.stringify({
      id: "local-admin",
      username: "dawooadmin",
      email: "admin@projecthub.local",
      name: "다우그룹 관리자",
      platformRole: "PLATFORM_ADMIN",
    }));

    render(
      <AuthProvider>
        <ProjectProvider>
          <ApprovalWorkspace />
        </ProjectProvider>
      </AuthProvider>,
    );

    await screen.findByText("표시할 결재 문서가 없습니다.");
    fireEvent.click(screen.getByRole("button", { name: /결재선 템플릿/ }));
    fireEvent.click(screen.getByRole("button", { name: "새 결재선 만들기" }));
    expect(screen.getByRole("option", { name: "김지훈test1" })).toBeInTheDocument();
    expect(screen.queryByText("승인 회원")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("템플릿 이름"), { target: { value: "로컬 승인 결재선" } });
    fireEvent.change(screen.getByLabelText("결재자 선택"), { target: { value: "local-approved-test1" } });
    fireEvent.click(screen.getByRole("button", { name: "+ 결재 단계 추가" }));
    fireEvent.click(screen.getByRole("button", { name: "템플릿 저장" }));

    expect(await screen.findByText("결재선 템플릿을 만들었습니다.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "로컬 승인 결재선" })).toBeInTheDocument();
    expect(window.localStorage.getItem("project-hub-local-approval-templates:30000000-0000-4000-8000-000000000001")).toContain("김지훈test1");
  });
});
