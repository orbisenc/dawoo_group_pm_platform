"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, type ReactNode, useEffect, useState } from "react";

import { FixedDrawingViewer } from "./fixed-drawing-viewer";

const ApartmentModelCanvas = dynamic(
  () => import("./apartment-model-canvas").then((module) => module.ApartmentModelCanvas),
  {
    ssr: false,
    loading: () => <div className="asset-viewer-state" role="status">아파트 3D 모델을 불러오는 중입니다.</div>,
  },
);

class ModelErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // 사용자에게는 기술 오류 대신 복구 방법을 안내한다.
  }

  render() {
    if (this.state.failed) {
      return <div className="asset-viewer-state error" role="alert"><strong>3D 모델을 표시하지 못했습니다.</strong><span>새로고침하거나 최신 Chrome·Edge에서 다시 확인해 주세요.</span></div>;
    }
    return this.props.children;
  }
}

function supportsWebGl() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

export function ModelStatusWorkspace() {
  const [webGl, setWebGl] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.resolve(supportsWebGl()).then(setWebGl);
  }, []);

  return (
    <section className="asset-status-workspace model-status-workspace">
      <header className="asset-status-title">
        <div><span>FIXED 3D ASSET</span><h2>3D 모델 현황</h2><p>프로젝트 기준 모델로 고정된 아파트 1개 동 GLB를 확인합니다.</p></div>
        <b className="asset-ready-badge">사용 가능</b>
      </header>
      <div className="asset-status-layout">
        <main className="asset-model-viewer">
          {webGl === null ? <div className="asset-viewer-state" role="status">그래픽 지원 여부를 확인하고 있습니다.</div> : webGl === false ? <div className="asset-viewer-state error" role="alert"><strong>3D 화면을 표시할 수 없습니다.</strong><span>브라우저의 WebGL과 하드웨어 가속을 켜 주세요.</span></div> : <ModelErrorBoundary><ApartmentModelCanvas /></ModelErrorBoundary>}
          <div className="asset-model-help">한 손가락·마우스: 회전 · 두 손가락·휠: 확대/축소 · 오른쪽 버튼: 이동</div>
        </main>
        <aside className="asset-status-panel">
          <span className="asset-type-label">GLB</span>
          <h3>PROJECT HUB 아파트 101동</h3>
          <p>18층 공동주택 1개 동을 외부 모델 없이 직접 제작한 고정 샘플입니다.</p>
          <dl>
            <div><dt>형식</dt><dd>GLB 2.0</dd></div>
            <div><dt>구성</dt><dd>18개 층·발코니·창호·옥상 구조물</dd></div>
            <div><dt>용도</dt><dd>프로젝트 3D 모델 현황 기준 자산</dd></div>
            <div><dt>출처</dt><dd>PROJECT HUB 자체 제작</dd></div>
          </dl>
          <a className="asset-primary-action" href="/samples/models/project-hub-apartment-tower.glb" download>GLB 원본 내려받기</a>
          <Link className="asset-secondary-action" href="/viewer">3D/BIM 뷰어로 이동</Link>
        </aside>
      </div>
    </section>
  );
}

export function DrawingStatusWorkspace() {
  return (
    <section className="asset-status-workspace drawing-status-workspace">
      <header className="asset-status-title">
        <div><span>FIXED 2D ASSET</span><h2>2D 도면 현황</h2><p>프로젝트 기준 구조도면을 고정 자산으로 관리합니다.</p></div>
        <b className="asset-ready-badge">사용 가능</b>
      </header>
      <div className="asset-status-layout">
        <main className="asset-drawing-viewer"><FixedDrawingViewer /></main>
        <aside className="asset-status-panel">
          <span className="asset-type-label drawing">DWG</span>
          <h3>S-202 지상1층 구조평면도</h3>
          <p>지정된 사내 공유 드라이브의 DWG를 승인된 고해상도 변환본으로 고정 표시합니다.</p>
          <dl>
            <div><dt>형식</dt><dd>DWG</dd></div>
            <div><dt>분류</dt><dd>건축구조 · 지상 1층</dd></div>
            <div><dt>도면 번호</dt><dd>S-202</dd></div>
            <div><dt>표시 방식</dt><dd>DWG 배치1 · 고해상도 변환본</dd></div>
          </dl>
          <a className="asset-primary-action" href="/samples/drawings/S-202-ground-floor-structural-plan.png" target="_blank" rel="noreferrer">고해상도 도면 열기</a>
          <Link className="asset-secondary-action" href="/cad">CAD 도면 뷰어로 이동</Link>
          <small className="asset-security-note">원본 DWG는 사내 공유 드라이브에 유지하고, 승인된 도면 변환본만 웹 화면에 제공합니다.</small>
        </aside>
      </div>
    </section>
  );
}
