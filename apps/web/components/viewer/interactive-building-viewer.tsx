"use client";

import dynamic from "next/dynamic";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { DemoViewerAdapter, type ViewerIssue, type ViewerObject } from "../../lib/viewer-adapter";
import type { ViewerCanvasHandle } from "./viewer-canvas";

const ViewerCanvas = dynamic(() => import("./viewer-canvas").then((module) => module.ViewerCanvas), {
  ssr: false,
  loading: () => <div className="viewer-loading" role="status">3D 데모 모델을 준비하고 있습니다.</div>,
});

const adapter = new DemoViewerAdapter();

function supportsWebGl() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

export function InteractiveBuildingViewer() {
  const canvasRef = useRef<ViewerCanvasHandle | null>(null);
  const [objects, setObjects] = useState<ViewerObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleFloors, setVisibleFloors] = useState<Set<string>>(new Set());
  const [issues, setIssues] = useState<ViewerIssue[]>([]);
  const [issueTitle, setIssueTitle] = useState("");
  const [creatingIssue, setCreatingIssue] = useState(false);
  const [webGl, setWebGl] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.resolve(supportsWebGl()).then(setWebGl);
    void adapter.loadObjects().then((items) => {
      setObjects(items);
      setVisibleFloors(new Set(items.map((item) => item.floorKey)));
    });
  }, []);

  const floors = useMemo(() => Array.from(new Set(objects.map((object) => object.floorKey))), [objects]);
  const selected = objects.find((object) => object.id === selectedId) ?? null;
  const selectObject = (id: string | null) => {
    setSelectedId(id);
    if (!id) { setIssues([]); return; }
    void adapter.loadIssues(id).then(setIssues);
  };
  const toggleFloor = (floor: string) => setVisibleFloors((current) => {
    const next = new Set(current);
    if (next.has(floor)) next.delete(floor); else next.add(floor);
    const hiddenSelected = selected && selected.floorKey === floor && !next.has(floor);
    if (hiddenSelected) selectObject(null);
    return next;
  });
  const submitIssue = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !issueTitle.trim()) return;
    const created = await adapter.createIssue({ objectId: selected.id, title: issueTitle });
    setIssues((current) => [created, ...current]);
    setIssueTitle("");
    setCreatingIssue(false);
  };

  return (
    <section className="interactive-viewer" aria-label="인터랙티브 3D 건물 뷰어">
      <header className="interactive-viewer-toolbar">
        <div><span>DEMO</span><strong>{adapter.modelName}</strong><small>3D 데모 모델 — 실제 BIM 연동 전</small></div>
        <div>
          <button type="button" onClick={() => canvasRef.current?.fit()} aria-label="건물 전체 보기">전체 보기</button>
          <button type="button" onClick={() => canvasRef.current?.reset()} aria-label="3D 시점 초기화">시점 초기화</button>
        </div>
      </header>
      <div className="interactive-viewer-body">
        <div className="viewer-stage">
          {webGl === false ? (
            <div className="webgl-error" role="alert"><b>3D 화면을 표시할 수 없습니다.</b><p>이 브라우저는 WebGL을 지원하지 않거나 그래픽 가속이 꺼져 있습니다. 최신 Chrome 또는 Edge에서 하드웨어 가속을 켠 뒤 다시 시도해 주세요.</p></div>
          ) : webGl === null ? (
            <div className="viewer-loading" role="status">그래픽 지원 여부를 확인하고 있습니다.</div>
          ) : (
            <ViewerCanvas ref={canvasRef} objects={objects} visibleFloors={visibleFloors} selectedId={selectedId} onSelect={selectObject} />
          )}
          <div className="viewer-help">마우스 왼쪽: 회전 · 휠: 확대/축소 · 오른쪽: 화면 이동</div>
          <aside className="floor-visibility" aria-label="층별 표시 설정">
            <strong>층별 표시</strong>
            {floors.map((floor) => <label key={floor}><input type="checkbox" checked={visibleFloors.has(floor)} onChange={() => toggleFloor(floor)} /> {floor}</label>)}
          </aside>
        </div>
        <aside className="object-properties" aria-live="polite">
          {selected ? <>
            <span className="object-selection-label">선택 객체</span>
            <h3>{selected.name}</h3>
            <dl>
              <div><dt>객체 ID</dt><dd>{selected.id}</dd></div>
              <div><dt>객체명</dt><dd>{selected.name}</dd></div>
              <div><dt>층</dt><dd>{selected.floor}</dd></div>
              <div><dt>부재 유형</dt><dd>{selected.memberType}</dd></div>
              <div><dt>공사 상태</dt><dd><b className={`construction-status status-${selected.status.replaceAll(" ", "-")}`}>{selected.status}</b></dd></div>
            </dl>
            <div className="object-issues">
              <div><h4>관련 이슈 <b>{issues.length}</b></h4><button type="button" onClick={() => setCreatingIssue((current) => !current)}>+ 이슈 생성</button></div>
              {creatingIssue && <form onSubmit={submitIssue}><label htmlFor="viewer-issue-title">이슈 제목</label><input id="viewer-issue-title" value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} placeholder={`${selected.name} 관련 이슈`} required maxLength={100} /><button type="submit">등록</button></form>}
              {issues.length ? issues.map((issue) => <article key={issue.id}><span>{issue.status}</span><strong>{issue.title}</strong><small>{issue.id} · {issue.createdAt}</small></article>) : <p>이 객체와 연결된 이슈가 없습니다.</p>}
            </div>
          </> : <div className="object-empty"><span>◇</span><b>건물 객체를 선택해 주세요.</b><p>객체를 클릭하면 속성과 관련 이슈가 표시됩니다.</p></div>}
        </aside>
      </div>
    </section>
  );
}
