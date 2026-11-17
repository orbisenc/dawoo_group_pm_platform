"use client";

import type { ApiHealthResponse } from "@project-hub/contracts";
import { isApiHealthResponse } from "@project-hub/contracts";
import { useEffect, useState } from "react";

type ConnectionState =
  | { kind: "loading" }
  | { kind: "connected"; data: ApiHealthResponse }
  | { kind: "error"; message: string };

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/backend";

async function fetchApiHealth(): Promise<ApiHealthResponse> {
  const response = await fetch(`${apiBaseUrl}/health`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data: unknown = await response.json();
  if (!isApiHealthResponse(data)) throw new Error("응답 형식이 올바르지 않습니다.");
  return data;
}

const connectionError: ConnectionState = {
  kind: "error",
  message: "API에 연결할 수 없습니다. 백엔드 실행 상태를 확인해 주세요.",
};

export function ApiConnectionCard() {
  const [state, setState] = useState<ConnectionState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    void fetchApiHealth()
      .then((data) => {
        if (active) setState({ kind: "connected", data });
      })
      .catch(() => {
        if (active) setState(connectionError);
      });
    return () => {
      active = false;
    };
  }, []);

  const retryConnection = () => {
    setState({ kind: "loading" });
    void fetchApiHealth()
      .then((data) => setState({ kind: "connected", data }))
      .catch(() => setState(connectionError));
  };

  if (state.kind === "loading") {
    return (
      <div className="connection-card loading" aria-live="polite">
        <span className="status-dot" />
        <div><small>API 연결</small><strong>확인 중...</strong></div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="connection-card error" role="alert">
        <span className="status-dot" />
        <div><small>API 연결 실패</small><strong>{state.message}</strong></div>
        <button type="button" onClick={retryConnection}>다시 확인</button>
      </div>
    );
  }

  return (
    <div className="connection-card connected" aria-live="polite">
      <span className="status-dot" />
      <div>
        <small>API 연결됨 · v{state.data.version}</small>
        <strong>{state.data.service} 정상 작동 중</strong>
      </div>
      <span className="connection-time">
        {new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(
          new Date(state.data.timestamp),
        )}
      </span>
    </div>
  );
}
