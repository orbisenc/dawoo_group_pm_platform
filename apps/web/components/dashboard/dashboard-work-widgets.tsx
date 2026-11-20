"use client";

import Script from "next/script";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useOptionalAuth } from "../auth/auth-context";
import { DatabaseApprovalWorkspace } from "./database-approval-workspace";
import { GoogleDriveWorkspace } from "./google-drive-workspace";
import { useProject } from "./project-context";

const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";
const GOOGLE_CONSENT_KEY = "project-hub-google-drive-consent";

type GoogleTokenResponse = { access_token?: string; error_description?: string };
type GoogleTokenClient = { requestAccessToken(options?: { prompt?: string }): void };
type GoogleAccounts = {
  oauth2: {
    initTokenClient(options: {
      client_id: string;
      scope: string;
      callback(response: GoogleTokenResponse): void;
      error_callback?(error: { message?: string }): void;
    }): GoogleTokenClient;
  };
};
type GoogleWindow = Window & { google?: { accounts: GoogleAccounts } };

type SharedDrive = { id: string; name: string };
type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
};
type DriveFolder = { id: string; name: string };

type ApprovalStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN";
type ApprovalItem = {
  id: string;
  title: string;
  status: ApprovalStatus;
  updatedAt: string;
  createdBy: { id: string; name: string };
  revisions: Array<{
    steps: Array<{
      status: "PENDING" | "ACTIVE" | "APPROVED" | "REJECTED";
      sequence: number;
      approver: { id: string; name: string };
    }>;
  }>;
};

const approvalStatusText: Record<ApprovalStatus, string> = {
  DRAFT: "임시 저장",
  IN_REVIEW: "결재 중",
  APPROVED: "승인 완료",
  REJECTED: "반려",
  WITHDRAWN: "회수",
};

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatSize(value?: string) {
  const bytes = Number(value ?? 0);
  if (!bytes) return "-";
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.ceil(bytes / 1_024))} KB`;
}

function fileLabel(item: DriveItem) {
  if (item.mimeType === GOOGLE_FOLDER_MIME) return "폴더";
  const extension = item.name.split(".").pop()?.toUpperCase();
  return extension && extension.length <= 5 ? extension : "파일";
}

async function googleApi<T>(token: string, url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Google Drive 연결이 만료되었습니다. 다시 연결해 주세요."
        : "공유 드라이브를 불러오지 못했습니다.",
    );
  }
  return response.json() as Promise<T>;
}

function DashboardWorkspaceOverlay({
  open,
  title,
  titleId,
  closeLabel,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  titleId: string;
  closeLabel: string;
  onClose(): void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;
  return (
    <>
      <button
        type="button"
        className="dashboard-workspace-backdrop"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <section
        id={titleId}
        className="dashboard-workspace-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${titleId}-title`}
      >
        <header>
          <h2 id={`${titleId}-title`}>{title}</h2>
          <button type="button" onClick={onClose}>↙ 원래 크기</button>
        </header>
        <div className="dashboard-workspace-overlay-content">{children}</div>
      </section>
    </>
  );
}

function sharedDriveItemsUrl(folderId: string, driveId: string) {
  const params = new URLSearchParams({
    q: `'${folderId.replaceAll("'", "\\'")}' in parents and trashed = false`,
    corpora: "drive",
    driveId,
    spaces: "drive",
    orderBy: "folder,name_natural",
    pageSize: "8",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    fields: "files(id,name,mimeType,size,modifiedTime,webViewLink)",
  });
  return `https://www.googleapis.com/drive/v3/files?${params}`;
}

export function DashboardSharedDriveCard() {
  const overlayTitleId = useId();
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
  const tokenClient = useRef<GoogleTokenClient | null>(null);
  const attemptedReconnect = useRef(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [token, setToken] = useState("");
  const [drives, setDrives] = useState<SharedDrive[]>([]);
  const [selectedDriveId, setSelectedDriveId] = useState("");
  const [path, setPath] = useState<DriveFolder[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const loadFolder = useCallback(
    async (accessToken: string, driveId: string, folderId: string) => {
      const result = await googleApi<{ files?: DriveItem[] }>(
        accessToken,
        sharedDriveItemsUrl(folderId, driveId),
      );
      setItems(result.files ?? []);
    },
    [],
  );

  const initialize = useCallback(
    async (accessToken: string) => {
      setLoading(true);
      setError("");
      try {
        const result = await googleApi<{ drives?: SharedDrive[] }>(
          accessToken,
          "https://www.googleapis.com/drive/v3/drives?pageSize=100&fields=drives(id,name)",
        );
        const nextDrives = result.drives ?? [];
        const firstDrive = nextDrives[0];
        setDrives(nextDrives);
        setSelectedDriveId(firstDrive?.id ?? "");
        setPath([]);
        if (firstDrive) await loadFolder(accessToken, firstDrive.id, firstDrive.id);
        else setItems([]);
        window.localStorage.setItem(GOOGLE_CONSENT_KEY, "true");
      } catch (reason) {
        setToken("");
        setError(
          reason instanceof Error
            ? reason.message
            : "공유 드라이브를 불러오지 못했습니다.",
        );
      } finally {
        setLoading(false);
      }
    },
    [loadFolder],
  );

  useEffect(() => {
    const google = (window as GoogleWindow).google;
    if (!clientId || !scriptReady || !google) return;
    tokenClient.current = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          setError(response.error_description ?? "Google Drive 연결을 완료하지 못했습니다.");
          return;
        }
        setToken(response.access_token);
        void initialize(response.access_token);
      },
      error_callback: () => setError("Google Drive 연결 창을 열지 못했습니다."),
    });
    if (
      !attemptedReconnect.current &&
      window.localStorage.getItem(GOOGLE_CONSENT_KEY) === "true"
    ) {
      attemptedReconnect.current = true;
      tokenClient.current.requestAccessToken({ prompt: "" });
    }
  }, [clientId, initialize, scriptReady]);

  const selectDrive = async (driveId: string) => {
    if (!token || driveId === selectedDriveId) return;
    setLoading(true);
    setError("");
    setSelectedDriveId(driveId);
    setPath([]);
    try {
      await loadFolder(token, driveId, driveId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "공유 드라이브를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const openFolder = async (item: DriveItem) => {
    if (!token || !selectedDriveId) return;
    setLoading(true);
    setError("");
    try {
      await loadFolder(token, selectedDriveId, item.id);
      setPath((current) => [...current, { id: item.id, name: item.name }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "폴더를 열지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const goUp = async () => {
    if (!token || !selectedDriveId || path.length === 0) return;
    const nextPath = path.slice(0, -1);
    const folderId = nextPath.at(-1)?.id ?? selectedDriveId;
    setLoading(true);
    try {
      await loadFolder(token, selectedDriveId, folderId);
      setPath(nextPath);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "상위 폴더를 열지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const closeExpanded = useCallback(() => setIsExpanded(false), []);

  return (
    <>
    <DashboardWorkspaceOverlay
      open={isExpanded}
      title="공유 드라이브"
      titleId={overlayTitleId}
      closeLabel="확대된 공유 드라이브 닫기"
      onClose={closeExpanded}
    >
      <GoogleDriveWorkspace />
    </DashboardWorkspaceOverlay>
    <section className="mini-panel shared-files dashboard-drive-card">
      {clientId ? (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => setScriptReady(true)}
          onError={() => setError("Google 연결 모듈을 불러오지 못했습니다.")}
        />
      ) : null}
      <div className="mini-heading">
        <h3>공유 드라이브</h3>
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={overlayTitleId}
          onClick={() => setIsExpanded(true)}
        >
          ⛶ 크게 보기
        </button>
      </div>
      {!clientId ? (
        <div className="dashboard-widget-empty">
          <strong>Google Drive 연결 설정이 필요합니다.</strong>
          <span>관리자에게 Google Drive 연결 환경 설정을 요청해 주세요.</span>
          <button type="button" onClick={() => setIsExpanded(true)}>공유 드라이브 크게 보기</button>
        </div>
      ) : !token ? (
        <div className="dashboard-widget-empty">
          <strong>공유 드라이브를 연결해 주세요.</strong>
          <span>연결하면 참여 중인 드라이브와 파일을 바로 확인할 수 있습니다.</span>
          <button
            type="button"
            disabled={!scriptReady}
            onClick={() => tokenClient.current?.requestAccessToken({ prompt: "" })}
          >
            {scriptReady ? "Google Drive 연결" : "연결 준비 중…"}
          </button>
        </div>
      ) : (
        <>
          <div className="dashboard-drive-switcher" aria-label="공유 드라이브 선택">
            {drives.map((drive) => (
              <button
                className={drive.id === selectedDriveId ? "active" : ""}
                type="button"
                onClick={() => void selectDrive(drive.id)}
                key={drive.id}
              >
                ▣ {drive.name}
              </button>
            ))}
          </div>
          {drives.length === 0 ? (
            <div className="dashboard-widget-empty compact">
              <strong>참여 중인 공유 드라이브가 없습니다.</strong>
              <span>Google Workspace 권한을 확인해 주세요.</span>
            </div>
          ) : (
            <>
              <div className="dashboard-drive-path">
                <button type="button" disabled={path.length === 0} onClick={() => void goUp()}>
                  ← 상위
                </button>
                <span>{path.at(-1)?.name ?? drives.find((drive) => drive.id === selectedDriveId)?.name}</span>
              </div>
              <div className="dashboard-drive-items" aria-busy={loading}>
                {loading ? <p>파일을 불러오는 중입니다.</p> : null}
                {!loading && items.length === 0 ? <p>이 폴더가 비어 있습니다.</p> : null}
                {!loading && items.map((item) =>
                  item.mimeType === GOOGLE_FOLDER_MIME ? (
                    <button className="mini-file is-folder" type="button" onClick={() => void openFolder(item)} key={item.id}>
                      <b>폴더</b>
                      <span><strong>{item.name}</strong><small>폴더 열기</small></span>
                    </button>
                  ) : (
                    <a className="mini-file" href={item.webViewLink ?? `https://drive.google.com/drive/folders/${selectedDriveId}`} target="_blank" rel="noreferrer" key={item.id}>
                      <b>{fileLabel(item)}</b>
                      <span><strong>{item.name}</strong><small>{formatSize(item.size)} · {formatDate(item.modifiedTime)}</small></span>
                    </a>
                  ),
                )}
              </div>
            </>
          )}
        </>
      )}
      {error ? <p className="dashboard-widget-error" role="alert">{error}</p> : null}
    </section>
    </>
  );
}

async function approvalApi<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`/backend${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("결재 문서를 불러오지 못했습니다.");
  return response.json() as Promise<T>;
}

export function DashboardApprovalCard() {
  const overlayTitleId = useId();
  const auth = useOptionalAuth();
  const { selectedProject } = useProject();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (auth?.loading) return;
    let active = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        let accessToken = auth?.token ?? "";
        let currentUserId = auth?.user?.id ?? "";
        if (!accessToken) {
          const sessionResponse = await fetch("/backend/auth/dev-session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: "partner@projecthub.local" }),
          });
          if (!sessionResponse.ok) throw new Error("로그인 후 결재 문서를 확인해 주세요.");
          const session = (await sessionResponse.json()) as {
            accessToken: string;
            user: { id: string };
          };
          accessToken = session.accessToken;
          currentUserId = session.user.id;
        }
        const result = await approvalApi<{ items: ApprovalItem[] }>(
          `/projects/${selectedProject.id}/approvals?scope=all`,
          accessToken,
        );
        if (active) {
          setUserId(currentUserId);
          setItems(result.items);
        }
      } catch (reason) {
        if (active) {
          setItems([]);
          setError(reason instanceof Error ? reason.message : "결재 문서를 불러오지 못했습니다.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [auth?.loading, auth?.token, auth?.user?.id, selectedProject.id]);

  const pending = items.filter((item) =>
    item.revisions[0]?.steps.some(
      (step) => step.status === "ACTIVE" && step.approver.id === userId,
    ),
  );
  const closeExpanded = useCallback(() => setIsExpanded(false), []);

  return (
    <>
    <DashboardWorkspaceOverlay
      open={isExpanded}
      title="전자결재"
      titleId={overlayTitleId}
      closeLabel="확대된 전자결재 닫기"
      onClose={closeExpanded}
    >
      <DatabaseApprovalWorkspace />
    </DashboardWorkspaceOverlay>
    <section className="mini-panel mini-approvals dashboard-approval-card">
      <div className="mini-heading">
        <h3>내 결재 대기 <span>{pending.length}</span></h3>
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={overlayTitleId}
          onClick={() => setIsExpanded(true)}
        >
          ⛶ 크게 보기
        </button>
      </div>
      {loading ? <div className="dashboard-widget-empty compact"><strong>결재 문서를 불러오는 중입니다.</strong></div> : null}
      {!loading && error ? (
        <div className="dashboard-widget-empty compact" role="alert">
          <strong>결재함을 연결하지 못했습니다.</strong>
          <span>{error}</span>
          <button type="button" onClick={() => setIsExpanded(true)}>결재함 크게 보기</button>
        </div>
      ) : null}
      {!loading && !error && pending.length === 0 ? (
        <div className="dashboard-widget-empty compact">
          <strong>현재 처리할 결재가 없습니다.</strong>
          <span>{selectedProject.name}의 새 결재 요청이 여기에 표시됩니다.</span>
          <button type="button" onClick={() => setIsExpanded(true)}>전체 결재 문서 보기</button>
        </div>
      ) : null}
      {!loading && !error && pending.slice(0, 4).map((item) => {
        const activeStep = item.revisions[0]?.steps.find((step) => step.status === "ACTIVE");
        return (
          <button type="button" className="mini-approval" onClick={() => setIsExpanded(true)} key={item.id}>
            <span aria-hidden="true">▧</span>
            <div>
              <b className="waiting">{approvalStatusText[item.status]}</b>
              <strong>{item.title}</strong>
              <small>{item.createdBy.name} · {activeStep?.sequence ?? "-"}단계 · {formatDate(item.updatedAt)}</small>
            </div>
          </button>
        );
      })}
    </section>
    </>
  );
}
