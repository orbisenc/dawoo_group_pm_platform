"use client";

import Image from "next/image";
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";

const MIN_SCALE = 0.7;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;

type ViewState = { scale: number; x: number; y: number };
type DragState = { pointerId: number; startX: number; startY: number; originX: number; originY: number };

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

export function FixedDrawingViewer() {
  const [view, setView] = useState<ViewState>({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<DragState | null>(null);

  const zoom = useCallback((delta: number) => {
    setView((current) => ({ ...current, scale: clampScale(current.scale + delta) }));
  }, []);

  const reset = useCallback(() => {
    setView({ scale: 1, x: 0, y: 0 });
  }, []);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const currentDrag = drag.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    setView((current) => ({
      ...current,
      x: currentDrag.originX + event.clientX - currentDrag.startX,
      y: currentDrag.originY + event.clientY - currentDrag.startY,
    }));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    drag.current = null;
    setDragging(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const amount = event.shiftKey ? 60 : 24;
    if (event.key === "+" || event.key === "=") zoom(SCALE_STEP);
    else if (event.key === "-") zoom(-SCALE_STEP);
    else if (event.key === "0") reset();
    else if (event.key === "ArrowLeft") setView((current) => ({ ...current, x: current.x - amount }));
    else if (event.key === "ArrowRight") setView((current) => ({ ...current, x: current.x + amount }));
    else if (event.key === "ArrowUp") setView((current) => ({ ...current, y: current.y - amount }));
    else if (event.key === "ArrowDown") setView((current) => ({ ...current, y: current.y + amount }));
    else return;
    event.preventDefault();
  };

  return (
    <div className="fixed-drawing-viewer">
      <div className="drawing-viewer-toolbar" role="toolbar" aria-label="2D 도면 보기 도구">
        <button type="button" onClick={() => zoom(-SCALE_STEP)} aria-label="도면 축소">−</button>
        <output aria-live="polite" aria-label="도면 확대 비율">{Math.round(view.scale * 100)}%</output>
        <button type="button" onClick={() => zoom(SCALE_STEP)} aria-label="도면 확대">+</button>
        <button type="button" onClick={reset}>전체 보기</button>
      </div>
      <div
        className={`drawing-pan-surface${dragging ? " is-dragging" : ""}`}
        role="application"
        aria-label="S-202 지상1층 구조평면도 확대 및 이동 화면"
        tabIndex={0}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
      >
        <div
          className="drawing-transform-layer"
          data-testid="drawing-transform-layer"
          style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
        >
          <Image
            className="drawing-sheet-preview"
            src="/samples/drawings/S-202-ground-floor-structural-plan.png"
            alt="S-202 지상1층 구조평면도 실제 DWG 변환 도면"
            width={3509}
            height={2480}
            priority
            draggable={false}
          />
        </div>
      </div>
      <p className="drawing-viewer-help">휠·+/−: 확대/축소 · 드래그·방향키: 이동 · 0: 전체 보기</p>
    </div>
  );
}
