import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DrawingStatusWorkspace, ModelStatusWorkspace } from "./asset-status-workspaces";

vi.mock("next/dynamic", () => ({
  default: () => () => <div aria-label="아파트 3D 모델 테스트 캔버스" />,
}));

describe("고정 자산 현황 화면", () => {
  it("자체 제작 GLB 모델 정보와 원본 링크를 제공한다", async () => {
    render(<ModelStatusWorkspace />);

    expect(screen.getByRole("heading", { name: "3D 모델 현황" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PROJECT HUB 아파트 101동" })).toBeInTheDocument();
    expect(screen.getByText("PROJECT HUB 자체 제작")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GLB 원본 내려받기" })).toHaveAttribute(
      "href",
      "/samples/models/project-hub-apartment-tower.glb",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("WebGL과 하드웨어 가속");
  });

  it("승인된 DWG 변환 도면과 확대·이동 도구를 고정 표시한다", () => {
    render(<DrawingStatusWorkspace />);

    expect(screen.getByRole("heading", { name: "2D 도면 현황" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "S-202 지상1층 구조평면도" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /실제 DWG 변환 도면/ })).toHaveAttribute(
      "src",
      expect.stringContaining("S-202-ground-floor-structural-plan.png"),
    );
    expect(screen.getByRole("toolbar", { name: "2D 도면 보기 도구" })).toBeInTheDocument();
    expect(screen.getByRole("application", { name: /확대 및 이동 화면/ })).toBeInTheDocument();
    expect(screen.getByText("DWG 배치1 · 고해상도 변환본")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "고해상도 도면 열기" })).toHaveAttribute(
      "href",
      "/samples/drawings/S-202-ground-floor-structural-plan.png",
    );
    expect(screen.getByRole("link", { name: "CAD 도면 뷰어로 이동" })).toHaveAttribute("href", "/cad");
  });
});
