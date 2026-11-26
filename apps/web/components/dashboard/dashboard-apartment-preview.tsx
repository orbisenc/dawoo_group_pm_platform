"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useEffect, useState } from "react";

const ApartmentModelCanvas = dynamic(
  () => import("./apartment-model-canvas").then((module) => module.ApartmentModelCanvas),
  {
    ssr: false,
    loading: () => <div className="dashboard-model-state" role="status">아파트 3D 모델을 불러오는 중입니다.</div>,
  },
);

class DashboardModelErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // 기술 오류 대신 사용자가 취할 수 있는 복구 방법을 표시한다.
  }

  render() {
    if (this.state.failed) {
      return <div className="dashboard-model-state error" role="alert">3D 모델을 표시하지 못했습니다. 새로고침해 주세요.</div>;
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

export function DashboardApartmentPreview() {
  const [webGl, setWebGl] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.resolve(supportsWebGl()).then(setWebGl);
  }, []);

  return (
    <div className="dashboard-apartment-preview" role="region" aria-label="PROJECT HUB 아파트 101동 인터랙티브 3D 미리보기">
      {webGl === null ? (
        <div className="dashboard-model-state" role="status">그래픽 지원 여부를 확인하고 있습니다.</div>
      ) : webGl === false ? (
        <div className="dashboard-model-state error" role="alert">브라우저의 WebGL과 하드웨어 가속을 켜 주세요.</div>
      ) : (
        <DashboardModelErrorBoundary><ApartmentModelCanvas /></DashboardModelErrorBoundary>
      )}
      <div className="dashboard-model-help">마우스·한 손가락: 회전 · 휠·두 손가락: 확대 · 오른쪽 버튼: 이동</div>
    </div>
  );
}
