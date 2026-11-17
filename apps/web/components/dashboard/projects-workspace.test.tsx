import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProjectProvider } from "./project-context";
import { ProjectsWorkspace } from "./projects-workspace";

describe("다우그룹 프로젝트 포트폴리오", () => {
  it("공식 프로젝트를 검색하고 협업 프로젝트로 선택한다", () => {
    render(
      <ProjectProvider>
        <ProjectsWorkspace />
      </ProjectProvider>,
    );

    expect(screen.getByText("의왕 학의지구 도시개발사업")).toBeInTheDocument();
    expect(screen.getByText("인천 을왕리 Sunset Island 복합리조트")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "프로젝트 검색" }), {
      target: { value: "세운" },
    });

    expect(screen.getByText("세운2지구 글로벌 프리미엄 복합개발사업")).toBeInTheDocument();
    expect(screen.queryByText("의왕 학의지구 도시개발사업")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "협업 프로젝트로 선택" }));
    expect(screen.getByRole("button", { name: "현재 협업 프로젝트" })).toBeInTheDocument();
  });
});
