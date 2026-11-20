import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectProvider } from "./project-context";
import { ProjectsWorkspace } from "./projects-workspace";

describe("다우그룹 프로젝트 포트폴리오", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("상태 분류 없이 전체 프로젝트만 표시하고 새 프로젝트를 추가한다", () => {
    render(
      <ProjectProvider>
        <ProjectsWorkspace />
      </ProjectProvider>,
    );

    expect(screen.getByRole("button", { name: "전체 3" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "기획" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "개발 검토" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /프로젝트 추가/ }));
    fireEvent.change(screen.getByLabelText(/프로젝트명/), {
      target: { value: "송도 복합개발사업" },
    });
    fireEvent.change(screen.getByLabelText("사업 유형"), {
      target: { value: "복합개발" },
    });
    fireEvent.change(screen.getByLabelText("프로젝트 위치"), {
      target: { value: "인천광역시 연수구" },
    });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "프로젝트 추가" }));

    expect(screen.getByText("송도 복합개발사업")).toBeInTheDocument();
    expect(screen.getByText("직접 등록")).toBeInTheDocument();
  });

  it("대표 이미지를 첨부해 프로젝트 배경으로 저장한다", async () => {
    render(
      <ProjectProvider>
        <ProjectsWorkspace />
      </ProjectProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /프로젝트 추가/ }));
    fireEvent.change(screen.getByLabelText(/프로젝트명/), {
      target: { value: "이미지 배경 프로젝트" },
    });
    fireEvent.change(screen.getByLabelText("프로젝트 대표 이미지"), {
      target: {
        files: [new File(["small-image"], "project-background.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByAltText("프로젝트 대표 이미지 미리보기")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "프로젝트 추가" }));

    expect(screen.getByAltText("이미지 배경 프로젝트 대표 이미지")).toBeInTheDocument();
  });

  it("기존 공식 프로젝트의 정보와 대표 이미지를 수정한다", async () => {
    render(
      <ProjectProvider>
        <ProjectsWorkspace />
      </ProjectProvider>,
    );

    const projectCard = screen.getByText("세운2지구 글로벌 프리미엄 복합개발사업").closest("article");
    expect(projectCard).not.toBeNull();
    fireEvent.click(within(projectCard as HTMLElement).getByRole("button", { name: "프로젝트 수정" }));

    const dialog = screen.getByRole("dialog", { name: "프로젝트 수정" });
    expect(within(dialog).getByLabelText(/프로젝트명/)).toHaveValue("세운2지구 글로벌 프리미엄 복합개발사업");
    fireEvent.change(within(dialog).getByLabelText("프로젝트 위치"), {
      target: { value: "서울특별시 중구 수정 위치" },
    });
    fireEvent.change(within(dialog).getByLabelText("프로젝트 대표 이미지 교체"), {
      target: {
        files: [new File(["updated-image"], "updated-background.webp", { type: "image/webp" })],
      },
    });

    expect(await within(dialog).findByText("updated-background.webp")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "수정사항 저장" }));

    expect(screen.getByText("⌖ 서울특별시 중구 수정 위치")).toBeInTheDocument();
    expect(screen.getByAltText("세운2지구 글로벌 프리미엄 복합개발사업 대표 이미지")).toHaveAttribute(
      "src",
      expect.stringContaining("data:image/webp;base64"),
    );
  });

  it("관리자는 확인 후 직접 등록한 프로젝트를 삭제한다", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <ProjectProvider>
        <ProjectsWorkspace adminMode />
      </ProjectProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /프로젝트 추가/ }));
    fireEvent.change(screen.getByLabelText(/프로젝트명/), {
      target: { value: "삭제 검증 프로젝트" },
    });
    fireEvent.change(screen.getByLabelText("사업 유형"), {
      target: { value: "도시개발" },
    });
    fireEvent.change(screen.getByLabelText("프로젝트 위치"), {
      target: { value: "서울특별시" },
    });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "프로젝트 추가" }));

    const projectCard = screen.getByText("삭제 검증 프로젝트").closest("article");
    expect(projectCard).not.toBeNull();
    fireEvent.click(within(projectCard as HTMLElement).getByRole("button", { name: "프로젝트 삭제" }));

    expect(window.confirm).toHaveBeenCalledWith("‘삭제 검증 프로젝트’ 프로젝트를 삭제할까요? 삭제 후 목록에서 제거됩니다.");
    expect(screen.queryByText("삭제 검증 프로젝트")).not.toBeInTheDocument();
  });
});
