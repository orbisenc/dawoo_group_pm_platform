import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DatabaseDashboard } from "./database-dashboard";
import { ProjectProvider } from "./project-context";

describe("실제 데이터 통합 대시보드", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("API 데이터가 없으면 업무별 빈 상태를 표시한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            projects: [],
            selectedProjectId: null,
            myIssues: [],
            unresolvedIssues: [],
            upcomingEvents: [],
            recentFiles: [],
            pendingApprovalCount: 0,
            projectActivity: [],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ProjectProvider>
        <DatabaseDashboard />
      </ProjectProvider>,
    );
    expect(
      await screen.findByText("담당 중인 이슈가 없습니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("30일 이내 일정이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("공유된 문서가 없습니다.")).toBeInTheDocument();
    expect(
      screen.getByText("참여 중인 프로젝트가 없습니다."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/backend/dashboard?projectId=30000000-0000-4000-8000-000000000001",
      expect.objectContaining({ headers: { authorization: "Bearer token" } }),
    );
  });

  it("상단 프로젝트 탭을 누르면 해당 프로젝트 범위로 다시 조회한다", async () => {
    const projects = [
      {
        id: "30000000-0000-4000-8000-000000000001",
        code: "A-01",
        name: "프로젝트 A",
        status: "ACTIVE",
        updatedAt: "2026-10-28T00:00:00.000Z",
      },
      {
        id: "30000000-0000-4000-8000-000000000002",
        code: "B-02",
        name: "프로젝트 B",
        status: "ACTIVE",
        updatedAt: "2026-10-28T00:00:00.000Z",
      },
    ];
    const dashboard = {
      projects,
      selectedProjectId: projects[0]!.id,
      myIssues: [],
      unresolvedIssues: [],
      upcomingEvents: [],
      recentFiles: [],
      pendingApprovalCount: 0,
      projectActivity: [],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "token" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(dashboard), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "token" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ...dashboard, selectedProjectId: projects[1]!.id }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ProjectProvider>
        <DatabaseDashboard />
      </ProjectProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /프로젝트 B/ }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/backend/dashboard?projectId=${projects[1]!.id}`,
        expect.objectContaining({ headers: { authorization: "Bearer token" } }),
      ),
    );
  });
});
