import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProjectProvider } from "./project-context";
import { ReferenceDashboard } from "./reference-dashboard";

describe("참조 이미지형 통합 대시보드", () => {
  it("프로젝트, 이슈 피드, 3D와 업무 위젯을 한 화면에 배치한다", () => {
    render(
      <ProjectProvider>
        <ReferenceDashboard />
      </ProjectProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "의왕 학의지구 도시개발사업" }),
    ).toBeInTheDocument();
    expect(screen.getByText("협업 공간 준비 상태")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "프로젝트" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "이슈 피드" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/BIM 통합 모델 미리보기/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "공유 파일" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "주요 일정" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "승인 대기" }),
    ).toBeInTheDocument();
  });
});
