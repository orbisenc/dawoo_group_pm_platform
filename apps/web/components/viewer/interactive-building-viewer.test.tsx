import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({
  default: () => function MockCanvas() { return <div>3D 캔버스</div>; },
}));

import { InteractiveBuildingViewer } from "./interactive-building-viewer";

describe("InteractiveBuildingViewer", () => {
  it("데모 모델 고지와 WebGL 미지원 안내를 제공한다", async () => {
    render(<InteractiveBuildingViewer />);

    expect(screen.getByText("3D 데모 모델 — 실제 BIM 연동 전")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("WebGL을 지원하지 않거나 그래픽 가속이 꺼져 있습니다");
    expect(screen.getByRole("button", { name: "건물 전체 보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3D 시점 초기화" })).toBeInTheDocument();
  });
});
