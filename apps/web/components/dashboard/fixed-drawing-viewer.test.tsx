import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FixedDrawingViewer } from "./fixed-drawing-viewer";

describe("고정 2D 도면 보기 도구", () => {
  it("버튼과 키보드로 확대·축소하고 전체 보기로 복원한다", () => {
    render(<FixedDrawingViewer />);
    const layer = screen.getByTestId("drawing-transform-layer");
    const surface = screen.getByRole("application", { name: /확대 및 이동 화면/ });

    fireEvent.click(screen.getByRole("button", { name: "도면 확대" }));
    expect(screen.getByLabelText("도면 확대 비율")).toHaveTextContent("125%");
    expect(layer).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(1.25)" });

    fireEvent.keyDown(surface, { key: "ArrowRight" });
    expect(layer).toHaveStyle({ transform: "translate3d(24px, 0px, 0) scale(1.25)" });

    fireEvent.click(screen.getByRole("button", { name: "전체 보기" }));
    expect(screen.getByLabelText("도면 확대 비율")).toHaveTextContent("100%");
    expect(layer).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(1)" });
  });

  it("마우스 휠과 드래그 이동을 지원한다", () => {
    render(<FixedDrawingViewer />);
    const surface = screen.getByRole("application", { name: /확대 및 이동 화면/ });
    const layer = screen.getByTestId("drawing-transform-layer");

    fireEvent.wheel(surface, { deltaY: -100 });
    expect(screen.getByLabelText("도면 확대 비율")).toHaveTextContent("125%");

    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 20, clientY: 30 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 70, clientY: 90 });
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 70, clientY: 90 });
    expect(layer).toHaveStyle({ transform: "translate3d(50px, 60px, 0) scale(1.25)" });
  });
});
