import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IssuesWorkspace } from "./issues-workspace";
import { ProjectProvider } from "./project-context";

describe("이슈 피드 메뉴 화면", () => {
  it("통합 대시보드와 동일한 프로젝트 목록과 이슈 피드를 표시한다", () => {
    render(
      <ProjectProvider>
        <IssuesWorkspace />
      </ProjectProvider>,
    );

    expect(screen.getByRole("heading", { name: "프로젝트" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "이슈 피드" })).toBeInTheDocument();
    expect(
      screen.getByText("분양가·사업비 변동에 따른 수익성 민감도 검토"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /인천 을왕리 Sunset Island/ }),
    );
    expect(
      screen.getByText("객실 가동률·ADR 기준 리조트 운영수지 검토"),
    ).toBeInTheDocument();
  });
});
