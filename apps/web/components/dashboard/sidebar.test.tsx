import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "./sidebar";

const { logout, authorizedFetch, countUnreadIssues, markNavigationSectionSeen, routeState } = vi.hoisted(() => ({
  logout: vi.fn(),
  authorizedFetch: vi.fn(),
  countUnreadIssues: vi.fn().mockResolvedValue(4),
  markNavigationSectionSeen: vi.fn(),
  routeState: { pathname: "/" },
}));

vi.mock("next/navigation", () => ({ usePathname: () => routeState.pathname }));
vi.mock("../../lib/navigation-badges", () => ({
  countUnreadIssues,
  markNavigationSectionSeen,
  navigationBadgeEvent: "project-hub-navigation-badge-change",
  readSeenAt: () => "",
}));
vi.mock("../auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "admin-1",
      username: "dawooadmin",
      email: "admin@projecthub.local",
      name: "다우그룹 관리자",
      platformRole: "PLATFORM_ADMIN",
    },
    isAdmin: true,
    token: "test-token",
    authorizedFetch,
    logout,
  }),
}));
vi.mock("./project-context", () => ({
  useProject: () => ({
    selectedProject: { id: "project-1", name: "세운2지구 프로젝트" },
  }),
}));

describe("사이드바 사용자 메뉴", () => {
  beforeEach(() => {
    logout.mockClear();
    countUnreadIssues.mockClear();
    markNavigationSectionSeen.mockClear();
    authorizedFetch.mockReset().mockResolvedValue(new Response(JSON.stringify({
      items: [
        { status: "IN_REVIEW", updatedAt: "2026-11-20T02:00:00.000Z" },
        { status: "DRAFT", updatedAt: "2026-11-20T03:00:00.000Z" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    routeState.pathname = "/";
  });

  it("계정 정보와 업무 메뉴를 열고 로그아웃한다", async () => {
    render(<Sidebar />);
    expect(await screen.findByLabelText("이슈 피드 미확인 4건")).toBeInTheDocument();
    expect(await screen.findByLabelText("결재 미확인 1건")).toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "사용자 메뉴" });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "계정 메뉴" })).toBeInTheDocument();
    expect(screen.getByText("@dawooadmin")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "프로젝트 관리" })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("menuitem", { name: "관리자 설정" })).toHaveAttribute("href", "/admin");

    fireEvent.click(screen.getByRole("menuitem", { name: "로그아웃" }));
    expect(logout).toHaveBeenCalledOnce();
  });

  it("관리자와 프로젝트 사이에 프로젝트 기획 현황과 뷰어 기능을 순서대로 표시한다", async () => {
    render(<Sidebar />);
    await screen.findByLabelText("이슈 피드 미확인 4건");

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    const labels = Array.from(navigation.querySelectorAll("a, .nav-section-label")).map((element) => element.textContent?.trim());
    expect(labels).toEqual([
      "통합 대시보드",
      "이슈 피드4",
      "공유 드라이브",
      "일정",
      "결재1",
      "관리자",
      "프로젝트 기획 현황",
      "2D 도면 현황",
      "3D 모델 현황",
      "뷰어 기능",
      "CAD 도면 뷰어",
      "3D/BIM 뷰어3D",
      "프로젝트3",
    ]);
  });

  it("Esc 키로 열린 메뉴를 닫는다", async () => {
    render(<Sidebar />);
    expect(await screen.findByLabelText("이슈 피드 미확인 4건")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "사용자 메뉴" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "계정 메뉴" })).not.toBeInTheDocument();
  });

  it("이슈 탭을 확인하면 미확인 숫자를 초기화한다", async () => {
    routeState.pathname = "/issues";
    render(<Sidebar />);

    await waitFor(() => {
      expect(markNavigationSectionSeen).toHaveBeenCalledWith("issues", "admin-1", "project-1");
    });
    expect(screen.queryByLabelText(/이슈 피드 미확인/)).not.toBeInTheDocument();
  });

  it("결재 탭을 확인하면 미확인 숫자를 초기화한다", async () => {
    routeState.pathname = "/approvals";
    render(<Sidebar />);

    await waitFor(() => {
      expect(markNavigationSectionSeen).toHaveBeenCalledWith("approvals", "admin-1", "project-1");
    });
    expect(screen.queryByLabelText(/결재 미확인/)).not.toBeInTheDocument();
  });
});
