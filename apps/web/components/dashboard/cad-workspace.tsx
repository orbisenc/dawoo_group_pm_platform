"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";

import { DriveItemIcon, type GoogleDriveFile, isDriveFolder, resolveDriveItem } from "./google-drive-workspace";
import { useProject } from "./project-context";

const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const CAD_DRAG_TYPE = "application/x-project-hub-google-drive-cad";
const BIM_DRAG_TYPE = "application/x-project-hub-google-drive-bim";
const GOOGLE_CONSENT_KEY = "project-hub-google-drive-consent";
const CAD_VIEWER_CO_URL = "https://cadviewer.co/viewer";
const BIM_VIEWER_CO_URL = "https://3dviewer.co/viewer";

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
type DriveFolder = { id: string; name: string };
type CadViewerDrawing = { fileName: string; url: string; savedAt: number };

const MODEL_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const CAD_HISTORY_LIMIT = 5;

export function buildViewerSessionKey(projectId: string, kind: "cad" | "bim") {
  return `project-hub:${projectId}:${kind}:viewer-model`;
}

function clearViewerSession(storageKey: string) {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // 브라우저 저장소가 차단된 경우 별도 정리 작업이 필요하지 않다.
  }
}

function readCadDrawingSession(storageKey: string, viewerUrl = CAD_VIEWER_CO_URL): CadViewerDrawing | null {
  try {
    const value = window.sessionStorage.getItem(storageKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<CadViewerDrawing>;
    const valid = typeof parsed.fileName === "string"
      && typeof parsed.url === "string"
      && parsed.url.startsWith(viewerUrl)
      && typeof parsed.savedAt === "number"
      && Date.now() - parsed.savedAt < MODEL_SESSION_LIFETIME_MS;
    if (!valid) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }
    return parsed as CadViewerDrawing;
  } catch {
    return null;
  }
}

function writeCadDrawingSession(storageKey: string, drawing: CadViewerDrawing) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(drawing));
  } catch {
    // 저장소가 차단되어도 현재 CADViewer 전용 창 열기는 계속 진행한다.
  }
}

export function buildCadHistoryKey(projectId: string) {
  return `project-hub:${projectId}:cad:recent-drawings`;
}

export function buildBimHistoryKey(projectId: string) {
  return `project-hub:${projectId}:bim:recent-models`;
}

export function readCadDrawingHistory(storageKey: string, now = Date.now(), viewerUrl = CAD_VIEWER_CO_URL) {
  try {
    const stored = window.sessionStorage.getItem(storageKey);
    const drawings = stored ? JSON.parse(stored) as Partial<CadViewerDrawing>[] : [];
    return drawings.filter((drawing): drawing is CadViewerDrawing => (
      typeof drawing.fileName === "string"
      && typeof drawing.url === "string"
      && drawing.url.startsWith(viewerUrl)
      && typeof drawing.savedAt === "number"
      && now - drawing.savedAt < MODEL_SESSION_LIFETIME_MS
    )).slice(0, CAD_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function buildCadViewerCoUrl(fileId?: string) {
  const url = new URL(CAD_VIEWER_CO_URL);
  if (fileId) {
    url.searchParams.set("state", JSON.stringify({ action: "open", ids: [fileId] }));
  }
  return url.toString();
}

export function buildBimViewerCoUrl(fileId?: string) {
  const url = new URL(BIM_VIEWER_CO_URL);
  if (fileId) {
    url.searchParams.set("state", JSON.stringify({ action: "open", ids: [fileId] }));
  }
  return url.toString();
}

export function writeCadDrawingHistory(storageKey: string, drawing: CadViewerDrawing, viewerUrl = CAD_VIEWER_CO_URL) {
  const drawings = [drawing, ...readCadDrawingHistory(storageKey, Date.now(), viewerUrl).filter((item) => item.url !== drawing.url)].slice(0, CAD_HISTORY_LIMIT);
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(drawings));
  } catch {
    // 저장소가 차단되어도 현재 도면 열기에는 영향을 주지 않는다.
  }
  return drawings;
}

export function isCadFile(item: Pick<GoogleDriveFile, "name" | "mimeType" | "shortcutDetails">) {
  if (isDriveFolder(item as GoogleDriveFile)) return false;
  const extension = item.name.split(".").pop()?.toLowerCase();
  return extension === "dwg" || extension === "dxf";
}

export function isBimFile(item: Pick<GoogleDriveFile, "name" | "mimeType" | "shortcutDetails">) {
  if (isDriveFolder(item as GoogleDriveFile)) return false;
  const extension = item.name.split(".").pop()?.toLowerCase();
  return ["gltf", "glb", "stl", "obj", "fbx", "stp", "step", "ply", "3dm"].includes(extension ?? "");
}

export function buildCadDriveListUrl(folderId: string, sharedDriveId?: string) {
  const params = new URLSearchParams({
    q: `'${folderId.replaceAll("'", "\\'")}' in parents and trashed = false`,
    spaces: "drive",
    orderBy: "folder,name_natural",
    pageSize: "200",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    fields: "files(id,name,mimeType,size,modifiedTime,webViewLink,shortcutDetails(targetId,targetMimeType),capabilities(canDownload))",
    corpora: sharedDriveId ? "drive" : "user",
  });
  if (sharedDriveId) params.set("driveId", sharedDriveId);
  return `https://www.googleapis.com/drive/v3/files?${params}`;
}

async function googleApi<T>(token: string, url: string): Promise<T> {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new Error(response.status === 401
      ? "Google Drive 연결이 만료되었습니다. 다시 연결해 주세요."
      : "Google Drive 도면을 불러오지 못했습니다.");
  }
  return response.json() as Promise<T>;
}

type WorkspaceKind = "cad" | "bim";

function DriveViewerWorkspace({ kind }: { kind: WorkspaceKind }) {
  const isBim = kind === "bim";
  const supportedLabel = isBim ? "GLTF·GLB·STL·OBJ·FBX·STEP·PLY·3DM" : "DWG·DXF";
  const dragType = isBim ? BIM_DRAG_TYPE : CAD_DRAG_TYPE;
  const isSupportedFile = isBim ? isBimFile : isCadFile;
  const { selectedProject } = useProject();
  const modelSessionKey = buildViewerSessionKey(selectedProject.id, kind);
  const viewerHistoryKey = isBim ? buildBimHistoryKey(selectedProject.id) : buildCadHistoryKey(selectedProject.id);
  const viewerBaseUrl = isBim ? BIM_VIEWER_CO_URL : CAD_VIEWER_CO_URL;
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const googleTokenClient = useRef<GoogleTokenClient | null>(null);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [selectedSharedDriveId, setSelectedSharedDriveId] = useState("");
  const [path, setPath] = useState<DriveFolder[]>([]);
  const [items, setItems] = useState<GoogleDriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cadDrawing, setCadDrawing] = useState<CadViewerDrawing | null>(null);
  const [recentCadDrawings, setRecentCadDrawings] = useState<CadViewerDrawing[]>([]);

  useEffect(() => {
    const restoredCadDrawing = readCadDrawingSession(modelSessionKey, viewerBaseUrl);
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setCadDrawing(restoredCadDrawing);
      setRecentCadDrawings(readCadDrawingHistory(viewerHistoryKey, Date.now(), viewerBaseUrl));
      setError("");
      setNotice("");
      if (restoredCadDrawing) {
        setProgress(`기존 ${isBim ? "3D 모델" : "CAD 도면"} 연결을 복원했습니다.`);
      } else {
        setProgress("");
      }
    });
    return () => { active = false; };
  }, [isBim, modelSessionKey, viewerBaseUrl, viewerHistoryKey]);

  const loadFolder = useCallback(async (token: string, folderId: string, sharedDriveId?: string) => {
    setDriveLoading(true);
    try {
      const result = await googleApi<{ files?: GoogleDriveFile[] }>(token, buildCadDriveListUrl(folderId, sharedDriveId));
      setItems((result.files ?? []).filter((item) => isDriveFolder(item) || isSupportedFile(item)));
    } finally {
      setDriveLoading(false);
    }
  }, [isSupportedFile]);

  const loadGoogleRoot = useCallback(async (token: string) => {
    const result = await googleApi<{ drives?: SharedDrive[] }>(
      token,
      "https://www.googleapis.com/drive/v3/drives?pageSize=100&fields=drives(id,name)",
    );
    setSharedDrives(result.drives ?? []);
    setSelectedSharedDriveId("");
    setPath([]);
    await loadFolder(token, "root");
  }, [loadFolder]);

  useEffect(() => {
    if (!googleClientId || !googleScriptReady) return;
    const google = (window as GoogleWindow).google;
    if (!google) return;
    googleTokenClient.current = google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: GOOGLE_DRIVE_SCOPE,
      callback(response) {
        if (!response.access_token) {
          setError(response.error_description ?? "Google Drive 연결을 완료하지 못했습니다.");
          return;
        }
        setGoogleToken(response.access_token);
        window.localStorage.setItem(GOOGLE_CONSENT_KEY, "granted");
        setError("");
        void loadGoogleRoot(response.access_token).catch((reason) => {
          setError(reason instanceof Error ? reason.message : "Google Drive를 불러오지 못했습니다.");
        });
      },
      error_callback(error) {
        setError(error.message ?? "Google Drive 연결을 완료하지 못했습니다.");
      },
    });
    if (window.localStorage.getItem(GOOGLE_CONSENT_KEY) === "granted") {
      googleTokenClient.current.requestAccessToken({ prompt: "" });
    }
  }, [googleClientId, googleScriptReady, loadGoogleRoot]);

  const launchViewerWindow = useCallback((drawing?: CadViewerDrawing) => {
    const viewerName = isBim ? "3D Viewer" : "CADViewer";
    const width = Math.min(1440, Math.max(980, window.screen.availWidth - 120));
    const height = Math.min(960, Math.max(700, window.screen.availHeight - 120));
    const left = Math.max(0, window.screenX + Math.round((window.outerWidth - width) / 2));
    const top = Math.max(0, window.screenY + Math.round((window.outerHeight - height) / 2));
    const popup = window.open(
      drawing?.url ?? (isBim ? buildBimViewerCoUrl() : buildCadViewerCoUrl()),
      isBim ? "project-hub-3dviewer" : "project-hub-cadviewer",
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );
    if (!popup) {
      setError(`${viewerName} 전용 창이 차단되었습니다. 브라우저 주소창에서 이 사이트의 팝업을 허용한 뒤 다시 시도해 주세요.`);
      return false;
    }
    try {
      popup.opener = null;
    } catch {
      // 브라우저 보안 정책이 opener 변경을 막아도 전용 창 자체는 계속 사용할 수 있다.
    }
    popup.focus();
    setError("");
    setProgress(drawing ? `${drawing.fileName} 파일을 ${viewerName}로 전달했습니다.` : `${viewerName} 전용 창을 열었습니다.`);
    setNotice(`${viewerName} 전용 창에서 Google Drive를 연결하세요. 다음 파일부터는 같은 창을 재사용합니다.`);
    return true;
  }, [isBim]);

  const clearCurrentCadDrawing = useCallback(() => {
    clearViewerSession(modelSessionKey);
    setCadDrawing(null);
    setProgress("");
    setError("");
    setNotice(`현재 ${isBim ? "모델" : "도면"} 연결을 닫았습니다. 최근 목록에서 다시 열 수 있습니다.`);
  }, [isBim, modelSessionKey]);

  const reopenCadDrawing = useCallback((drawing: CadViewerDrawing) => {
    writeCadDrawingSession(modelSessionKey, drawing);
    setCadDrawing(drawing);
    launchViewerWindow(drawing);
  }, [launchViewerWindow, modelSessionKey]);

  const openGoogleItem = useCallback(async (item: GoogleDriveFile) => {
    if (!googleToken) return;
    if (!isSupportedFile(item)) {
      setError(`${supportedLabel} 파일만 뷰어에서 열 수 있습니다.`);
      return;
    }
    const resolved = resolveDriveItem(item);
    const drawing: CadViewerDrawing = {
      fileName: item.name,
      url: isBim ? buildBimViewerCoUrl(resolved.id) : buildCadViewerCoUrl(resolved.id),
      savedAt: Date.now(),
    };
    writeCadDrawingSession(modelSessionKey, drawing);
    setRecentCadDrawings(writeCadDrawingHistory(viewerHistoryKey, drawing, viewerBaseUrl));
    setCadDrawing(drawing);
    launchViewerWindow(drawing);
  }, [googleToken, isBim, isSupportedFile, launchViewerWindow, modelSessionKey, supportedLabel, viewerBaseUrl, viewerHistoryKey]);

  const handleViewerDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const localFile = event.dataTransfer.files[0];
    if (localFile) {
      launchViewerWindow();
      setNotice(`${isBim ? "3D Viewer" : "CADViewer"} 전용 창의 컴퓨터 파일 열기 기능에서 ${isBim ? "3D 모델" : "DWG/DXF 파일"}을 선택해 주세요.`);
      return;
    }
    const itemId = event.dataTransfer.getData(dragType);
    const item = items.find((candidate) => candidate.id === itemId);
    if (item) await openGoogleItem(item);
  };

  const selectDrive = async (driveId: string) => {
    if (!googleToken) return;
    setSelectedSharedDriveId(driveId);
    setPath([]);
    setError("");
    await loadFolder(googleToken, driveId || "root", driveId || undefined).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Google Drive를 불러오지 못했습니다.");
    });
  };

  const openFolder = async (folder: GoogleDriveFile) => {
    if (!googleToken) return;
    const resolved = resolveDriveItem(folder);
    setPath((current) => [...current, { id: resolved.id, name: folder.name }]);
    await loadFolder(googleToken, resolved.id, selectedSharedDriveId || undefined).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "폴더를 열지 못했습니다.");
    });
  };

  const goUp = async () => {
    if (!googleToken || path.length === 0) return;
    const nextPath = path.slice(0, -1);
    setPath(nextPath);
    const folderId = (nextPath.at(-1)?.id ?? selectedSharedDriveId) || "root";
    await loadFolder(googleToken, folderId, selectedSharedDriveId || undefined);
  };

  return (
    <section className="cad-workspace">
      {googleClientId ? <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGoogleScriptReady(true)} onError={() => setError("Google 연결 모듈을 불러오지 못했습니다.")} /> : null}
      <header className="cad-workspace-title">
        <div>
          <span>{isBim ? "3D BIM WORKSPACE" : "2D CAD WORKSPACE"}</span>
          <h2>{isBim ? "3D/BIM 뷰어" : "CAD 도면 뷰어"}</h2>
          <p>{isBim ? `Google Drive의 ${supportedLabel} 파일을 3D Viewer 전용 창에서 확인합니다.` : "Google Drive의 DWG·DXF 도면을 CADViewer 전용 창에서 빠르게 확인합니다."}</p>
        </div>
        <div className="cad-provider-state">
          <i className="ready" />
          {isBim ? "3D Viewer 전용 창 사용" : "CADViewer 전용 창 사용"}
        </div>
      </header>
      {error ? <div className="cad-message error" role="alert">{error}<button type="button" onClick={() => setError("")}>닫기</button></div> : null}
      {notice ? <div className="cad-message">{notice}<button type="button" onClick={() => setNotice("")}>닫기</button></div> : null}
      <div className="cad-layout">
        <main className="cad-viewer-panel">
          <div className="cad-viewer-toolbar">
            <div><strong>{cadDrawing?.fileName ?? (isBim ? "3D Viewer 전용 창" : "CADViewer 전용 창")}</strong><span>{progress || (isBim ? "3dviewer.co Google Drive Add-on" : "cadviewer.co Google Drive Add-on")}</span></div>
            <button type="button" onClick={() => launchViewerWindow(cadDrawing ?? undefined)}>{cadDrawing ? `${isBim ? "3D Viewer" : "CADViewer"}에서 다시 열기` : `${isBim ? "3D Viewer" : "CADViewer"} 열기`}</button>
            <button type="button" disabled={!cadDrawing} onClick={clearCurrentCadDrawing}>{isBim ? "모델 닫기" : "도면 닫기"}</button>
          </div>
          {recentCadDrawings.length > 0 ? <div className="cad-recent-drawings" aria-label={isBim ? "최근 모델" : "최근 도면"}>
            <strong>{isBim ? "최근 모델" : "최근 도면"}</strong>
            {recentCadDrawings.map((drawing) => <button type="button" className={cadDrawing?.url === drawing.url ? "active" : ""} onClick={() => reopenCadDrawing(drawing)} key={drawing.url}>{drawing.fileName}</button>)}
          </div> : null}
          <div
            className={`cad-viewer-dropzone${dragging ? " is-dragging" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
            onDrop={(event) => void handleViewerDrop(event)}
          >
            <div className="cad-viewer-window-launch" role="region" aria-label={isBim ? "3D Viewer 전용 창 실행" : "CADViewer 전용 창 실행"}>
              <span>{isBim ? "3DVIEWER.CO" : "CADVIEWER.CO"}</span>
              <strong>{cadDrawing?.fileName ?? `${isBim ? "3D Viewer" : "CADViewer"} 전용 창에서 ${isBim ? "모델" : "도면"}을 엽니다.`}</strong>
              <p>Google 인증과 {isBim ? "3D 모델 렌더링" : "DWG/DXF 렌더링"}은 브라우저 최상위 창에서 진행됩니다.</p>
              <button type="button" onClick={() => launchViewerWindow(cadDrawing ?? undefined)}>{cadDrawing ? `선택한 ${isBim ? "모델을 3D Viewer" : "도면을 CADViewer"}에서 열기` : `${isBim ? "3D Viewer" : "CADViewer"} 전용 창 열기`}</button>
              <small>오른쪽 Google Drive 파일을 클릭하거나 끌어 놓으면 같은 창을 재사용합니다.</small>
            </div>
            {dragging ? <div className="cad-drop-guide">여기에 놓아 {isBim ? "3D 모델" : "2D 도면"} 열기</div> : null}
          </div>
        </main>
        <aside className="cad-drive-panel">
          <div className="cad-drive-heading">
            <div><span>GOOGLE DRIVE</span><h3>{isBim ? "연결된 3D 모델" : "연결된 도면"}</h3></div>
            {googleToken ? <button type="button" onClick={() => { setGoogleToken(null); setItems([]); setSharedDrives([]); window.localStorage.removeItem(GOOGLE_CONSENT_KEY); }}>연결 해제</button> : null}
          </div>
          {!googleClientId ? <div className="cad-drive-empty"><strong>Google Drive 설정이 필요합니다.</strong><span>NEXT_PUBLIC_GOOGLE_CLIENT_ID를 설정해 주세요.</span></div> : !googleToken ? <div className="cad-drive-empty"><strong>Google Drive를 연결해 주세요.</strong><span>{supportedLabel} 파일만 읽기 권한으로 조회합니다.</span><button type="button" disabled={!googleScriptReady} onClick={() => googleTokenClient.current?.requestAccessToken({ prompt: "consent" })}>{googleScriptReady ? "Google Drive 연결" : "연결 준비 중"}</button></div> : <>
            <div className="cad-drive-selector">
              <button className={!selectedSharedDriveId ? "active" : ""} type="button" onClick={() => void selectDrive("")}>내 드라이브</button>
              {sharedDrives.map((drive) => <button className={selectedSharedDriveId === drive.id ? "active" : ""} type="button" onClick={() => void selectDrive(drive.id)} key={drive.id}>{drive.name}</button>)}
            </div>
            <div className="cad-drive-path"><button type="button" disabled={path.length === 0} onClick={() => void goUp()}>← 상위</button><strong>{path.at(-1)?.name ?? sharedDrives.find((drive) => drive.id === selectedSharedDriveId)?.name ?? "내 드라이브"}</strong></div>
            <div className="cad-drive-list" aria-busy={driveLoading}>
              {driveLoading ? <p>{isBim ? "3D 모델" : "도면"} 목록을 불러오는 중입니다.</p> : null}
              {!driveLoading && items.length === 0 ? <p>이 폴더에 {supportedLabel} 파일이 없습니다.</p> : null}
              {items.map((item) => {
                const folder = isDriveFolder(item);
                return <div className={`cad-drive-item${folder ? " is-folder" : ""}`} draggable={!folder} onDragStart={(event) => {
                  if (!folder) {
                    setDragging(true);
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData(dragType, item.id);
                  }
                }} onDragEnd={() => setDragging(false)} key={item.id}>
                  <DriveItemIcon file={item} />
                  <button type="button" onClick={() => folder ? void openFolder(item) : void openGoogleItem(item)}><strong>{item.name}</strong><small>{folder ? "폴더 열기" : "끌어서 열기 · 클릭해서 바로 열기"}</small></button>
                </div>;
              })}
            </div>
          </>}
          <footer><span>{supportedLabel} 원본은 PROJECT HUB 서버에 저장되지 않습니다.</span><small>{isBim ? "Google Drive → 3D Viewer 전용 창" : "Google Drive → CADViewer 전용 창"}</small></footer>
        </aside>
      </div>
    </section>
  );
}

export function CadWorkspace() {
  return <DriveViewerWorkspace kind="cad" />;
}

export function BimWorkspace() {
  return <DriveViewerWorkspace kind="bim" />;
}
