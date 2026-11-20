import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectProvider } from "./project-context";
import { ProjectGroupWorkspace } from "./project-group-workspace";

describe("프로젝트 그룹 이슈 피드", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("프로젝트 아래 네 개 그룹을 표시하고 선택한 그룹 피드를 연다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 502 })),
    );
    render(
      <ProjectProvider>
        <ProjectGroupWorkspace />
      </ProjectProvider>,
    );
    expect(screen.getByText("프로젝트 아래 협업 그룹")).toBeInTheDocument();
    for (const name of ["설계 관리", "시공 관리", "기획 관리", "공지 사항"])
      expect(
        screen.getByRole("button", { name: new RegExp(name) }),
      ).toBeInTheDocument();
    expect(await screen.findByText("로컬 저장 모드")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /시공 관리/ }));
    expect(
      screen.getByRole("heading", { name: "시공 관리" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("조건에 맞는 게시글이 없습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /기획 관리/ }));
    expect(await screen.findByText("조건에 맞는 게시글이 없습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /공지 사항/ }));
    expect(await screen.findByText("조건에 맞는 게시글이 없습니다.")).toBeInTheDocument();
  });
});
