import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IssueFeed } from "./issue-feed";
import { ProjectProvider } from "./project-context";
import { ProjectRail } from "./project-rail";
import { WorkspaceRight } from "./workspace-right";

describe("대시보드 프로젝트와 일정 연동", () => {
  it("프로젝트를 선택해도 샘플 이슈를 만들지 않고 빈 피드를 유지한다", async () => {
    render(
      <ProjectProvider>
        <ProjectRail />
        <IssueFeed />
      </ProjectProvider>,
    );

    expect(await screen.findByText("등록된 이슈가 없습니다.")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /인천 을왕리 Sunset Island/ }),
    );

    expect(await screen.findByText("등록된 이슈가 없습니다.")).toBeInTheDocument();
    expect(
      screen.queryByText("분양가·사업비 변동에 따른 수익성 민감도 검토"),
    ).not.toBeInTheDocument();
  });

  it("주요 일정 Teamup 캘린더를 확대하고 원래 크기로 복원한다", async () => {
    render(
      <ProjectProvider>
        <WorkspaceRight />
      </ProjectProvider>,
    );

    const calendar = screen.getByTitle(/Teamup 주요 일정/);
    expect(calendar).toHaveAttribute(
      "src",
      expect.stringContaining("teamup.com/ks27cco3hv5g1ove7k"),
    );
    expect(calendar).toHaveAttribute("src", expect.stringContaining("view=m"));
    expect(calendar).toHaveAttribute(
      "src",
      expect.stringContaining("showDateControls=1"),
    );
    const calendarPanel = screen.getByRole("heading", { name: "주요 일정" }).closest("section");
    expect(calendarPanel).not.toBeNull();
    const expandButton = within(calendarPanel!).getByRole("button", { name: /크게 보기/ });
    expect(expandButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(expandButton);
    expect(screen.getByRole("button", { name: /원래 크기/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByRole("button", { name: /확대된 주요 일정 닫기/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /원래 크기/ }));
    expect(within(calendarPanel!).getByRole("button", { name: /크게 보기/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await screen.findByText("결재함을 연결하지 못했습니다.");
  });
});
