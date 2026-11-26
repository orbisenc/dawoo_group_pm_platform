import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProjectProvider } from "./project-context";
import { ReferenceDashboard } from "./reference-dashboard";

describe("참조 이미지형 통합 대시보드", () => {
  it("프로젝트, 이슈 피드, 3D와 업무 위젯을 한 화면에 배치한다", async () => {
    render(
      <ProjectProvider>
        <ReferenceDashboard />
      </ProjectProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "의왕 학의지구 도시개발사업" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("협업 공간 준비 상태")).not.toBeInTheDocument();
    expect(screen.queryByText(/실제 사업 공정률이 아닙니다/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("프로젝트 주요 현황 바로가기")).not.toBeInTheDocument();
    expect(screen.queryByText("프로젝트 위치")).not.toBeInTheDocument();
    expect(screen.queryByText("사업면적")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "프로젝트" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "이슈 피드" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/BIM 통합 모델 미리보기/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "3D 모델 현황 열기" })).toHaveAttribute("href", "/model-status");
    expect(screen.getByText("GLB")).toBeInTheDocument();
    expect(screen.getByText("고정 모델")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /아파트 101동 인터랙티브 3D 미리보기/ })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "공유 드라이브" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "주요 일정" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /내 결재 대기/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전체 3" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "기획" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "새 프로젝트 추가" }));
    expect(screen.getByRole("dialog", { name: "새 프로젝트 추가" })).toBeInTheDocument();
  });
});
