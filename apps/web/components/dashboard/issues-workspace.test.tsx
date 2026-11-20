import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IssuesWorkspace } from "./issues-workspace";
import { ProjectProvider } from "./project-context";

describe("이슈 피드 메뉴 화면", () => {
  it("프로젝트 목록과 샘플 없는 이슈 피드를 표시한다", async () => {
    render(
      <ProjectProvider>
        <IssuesWorkspace />
      </ProjectProvider>,
    );

    expect(screen.getByRole("heading", { name: "프로젝트" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "이슈 피드" })).toBeInTheDocument();
    expect(screen.getByText("등록된 이슈가 없습니다.")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /인천 을왕리 Sunset Island/ }),
    );
    expect(await screen.findByText("등록된 이슈가 없습니다.")).toBeInTheDocument();
  });
});
