import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DashboardApprovalCard,
  DashboardSharedDriveCard,
} from "./dashboard-work-widgets";
import { ProjectProvider } from "./project-context";

describe("통합 대시보드 업무 카드", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  });

  it("공유 파일 예시 대신 Google 공유 드라이브 연결 상태를 표시한다", () => {
    render(<DashboardSharedDriveCard />);

    expect(screen.getByRole("heading", { name: "공유 드라이브" })).toBeInTheDocument();
    expect(screen.getByText("Google Drive 연결 설정이 필요합니다.")).toBeInTheDocument();
    expect(screen.queryByText("A-201_기준층평면도.dwg")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "⛶ 크게 보기" }));
    expect(screen.getByRole("dialog", { name: "공유 드라이브" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "↙ 원래 크기" }));
    expect(screen.queryByRole("dialog", { name: "공유 드라이브" })).not.toBeInTheDocument();
  });

  it("선택 프로젝트의 실제 결재 API에서 내 결재 대기 문서를 표시한다", async () => {
    const userId = "20000000-0000-4000-8000-000000000001";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ accessToken: "token", user: { id: userId } }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "approval-1",
                title: "공사비 변경 품의",
                status: "IN_REVIEW",
                updatedAt: "2026-11-20T00:00:00.000Z",
                createdBy: { id: "author-1", name: "김기안" },
                revisions: [
                  {
                    steps: [
                      {
                        status: "ACTIVE",
                        sequence: 2,
                        approver: { id: userId, name: "박결재" },
                      },
                    ],
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProjectProvider>
        <DashboardApprovalCard />
      </ProjectProvider>,
    );

    expect(await screen.findByText("공사비 변경 품의")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "내 결재 대기 1" })).toBeInTheDocument();
    expect(screen.getByText(/김기안 · 2단계/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/approvals?scope=all"),
      expect.objectContaining({ headers: { authorization: "Bearer token" } }),
    );

    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/approvals/context")) {
        return Promise.resolve(new Response(JSON.stringify({ files: [], members: [] }), { status: 200 }));
      }
      if (url.includes("/approvals/route-templates")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    });
    fireEvent.click(screen.getByRole("button", { name: "⛶ 크게 보기" }));
    expect(screen.getByRole("dialog", { name: "전자결재" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "전자결재" })).toHaveLength(2);
    expect(await screen.findByText("표시할 결재 문서가 없습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "↙ 원래 크기" }));
    expect(screen.queryByRole("dialog", { name: "전자결재" })).not.toBeInTheDocument();
  });
});
