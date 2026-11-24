"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";

import { useOptionalAuth } from "../auth/auth-context";
import { DriveItemIcon, type GoogleDriveFile, isDriveFolder, resolveDriveItem } from "./google-drive-workspace";
import { useProject } from "./project-context";

const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const CAD_DRAG_TYPE = "application/x-project-hub-google-drive-cad";
const BIM_DRAG_TYPE = "application/x-project-hub-google-drive-bim";
const GOOGLE_CONSENT_KEY = "project-hub-google-drive-consent";
const APS_VIEWER_SCRIPT = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js";
const APS_VIEWER_STYLE = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css";
const CAD_VIEWER_CO_URL = "https://cadviewer.co/viewer";

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
type CadModel = { urn: string; ticket: string; fileName: string };
type CadViewerDrawing = { fileName: string; url: string; savedAt: number };
type PersistedModel = CadModel & { savedAt: number };
type ViewerNode = object;
type ViewerDocument = {
  getRoot(): {
    search(criteria: Record<string, string>): ViewerNode[];
    getDefaultGeometry(): ViewerNode;
  };
};
type ApsViewer = {
  start(): number;
  finish(): void;
  loadDocumentNode(document: ViewerDocument, node: ViewerNode): Promise<unknown>;
  fitToView(): void;
  navigation?: { setRequestTransition(value: boolean, position?: unknown, target?: unknown, fov?: number): void };
};
type AutodeskApi = {
  Viewing: {
    Initializer(
      options: {
        env: string;
        api: string;
        getAccessToken(callback: (token: string, expiresIn: number) => void): void;
      },
      callback: () => void,
    ): void;
    GuiViewer3D: new (container: HTMLElement, options?: Record<string, unknown>) => ApsViewer;
    Document: {
      load(
        documentId: string,
        success: (document: ViewerDocument) => void,
        failure: (code: number, message?: string) => void,
      ): void;
    };
  };
};
type AutodeskWindow = Window & { Autodesk?: AutodeskApi };

const MODEL_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const CAD_HISTORY_LIMIT = 5;

export function buildViewerSessionKey(projectId: string, kind: "cad" | "bim") {
  return `project-hub:${projectId}:${kind}:viewer-model`;
}

function readViewerSession(storageKey: string): CadModel | null {
  try {
    const value = window.sessionStorage.getItem(storageKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<PersistedModel>;
    const valid = typeof parsed.urn === "string"
      && typeof parsed.ticket === "string"
      && typeof parsed.fileName === "string"
      && typeof parsed.savedAt === "number"
      && Date.now() - parsed.savedAt < MODEL_SESSION_LIFETIME_MS;
    if (!valid) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }
    return { urn: parsed.urn!, ticket: parsed.ticket!, fileName: parsed.fileName! };
  } catch {
    return null;
  }
}

function writeViewerSession(storageKey: string, model: CadModel) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify({ ...model, savedAt: Date.now() } satisfies PersistedModel));
  } catch {
    // 저장소가 차단된 환경에서도 현재 화면의 뷰어 로딩은 계속 진행한다.
  }
}

function clearViewerSession(storageKey: string) {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // 브라우저 저장소가 차단된 경우 별도 정리 작업이 필요하지 않다.
  }
}

function readCadDrawingSession(storageKey: string): CadViewerDrawing | null {
  try {
    const value = window.sessionStorage.getItem(storageKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<CadViewerDrawing>;
    const valid = typeof parsed.fileName === "string"
      && typeof parsed.url === "string"
      && parsed.url.startsWith(CAD_VIEWER_CO_URL)
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
    // 저장소가 차단되어도 현재 화면의 CADViewer 로딩은 계속 진행한다.
  }
}

export function buildCadHistoryKey(projectId: string) {
  return `project-hub:${projectId}:cad:recent-drawings`;
}

export function readCadDrawingHistory(storageKey: string, now = Date.now()) {
  try {
    const stored = window.sessionStorage.getItem(storageKey);
    const drawings = stored ? JSON.parse(stored) as Partial<CadViewerDrawing>[] : [];
    return drawings.filter((drawing): drawing is CadViewerDrawing => (
      typeof drawing.fileName === "string"
      && typeof drawing.url === "string"
      && drawing.url.startsWith(CAD_VIEWER_CO_URL)
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

export function writeCadDrawingHistory(storageKey: string, drawing: CadViewerDrawing) {
  const drawings = [drawing, ...readCadDrawingHistory(storageKey).filter((item) => item.url !== drawing.url)].slice(0, CAD_HISTORY_LIMIT);
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(drawings));
  } catch {
    // 저장소가 차단되어도 현재 도면 표시에는 영향을 주지 않는다.
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
  return ["ifc", "obj", "stp", "step", "skp"].includes(extension ?? "");
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

async function responseMessage(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
  if (Array.isArray(body?.message)) return body.message.join(" ");
  return body?.message ?? "요청을 처리하지 못했습니다.";
}

type WorkspaceKind = "cad" | "bim";

function DriveViewerWorkspace({ kind }: { kind: WorkspaceKind }) {
  const isBim = kind === "bim";
  const supportedLabel = isBim ? "IFC·OBJ·STP·STEP·SKP" : "DWG·DXF";
  const dragType = isBim ? BIM_DRAG_TYPE : CAD_DRAG_TYPE;
  const accepts = ".ifc,.obj,.stp,.step,.skp";
  const isSupportedFile = isBim ? isBimFile : isCadFile;
  const auth = useOptionalAuth();
  const { selectedProject } = useProject();
  const modelSessionKey = buildViewerSessionKey(selectedProject.id, kind);
  const cadHistoryKey = buildCadHistoryKey(selectedProject.id);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const googleTokenClient = useRef<GoogleTokenClient | null>(null);
  const viewerContainer = useRef<HTMLDivElement | null>(null);
  const viewer = useRef<ApsViewer | null>(null);
  const activeModelTicket = useRef("");
  const [backendToken, setBackendToken] = useState<string | null>(null);
  const [apsConfigured, setApsConfigured] = useState<boolean | null>(null);
  const [apsScriptReady, setApsScriptReady] = useState(false);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [selectedSharedDriveId, setSelectedSharedDriveId] = useState("");
  const [path, setPath] = useState<DriveFolder[]>([]);
  const [items, setItems] = useState<GoogleDriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [model, setModel] = useState<CadModel | null>(null);
  const [cadDrawing, setCadDrawing] = useState<CadViewerDrawing | null>(null);
  const [recentCadDrawings, setRecentCadDrawings] = useState<CadViewerDrawing[]>([]);
  const [modelStatus, setModelStatus] = useState<"idle" | "processing" | "ready" | "failed">("idle");

  useEffect(() => {
    const restored = isBim ? readViewerSession(modelSessionKey) : null;
    const restoredCadDrawing = isBim ? null : readCadDrawingSession(modelSessionKey);
    viewer.current?.finish();
    viewer.current = null;
    activeModelTicket.current = restored?.ticket ?? "";
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setModel(restored);
      setCadDrawing(restoredCadDrawing);
      setRecentCadDrawings(isBim ? [] : readCadDrawingHistory(cadHistoryKey));
      setError("");
      setNotice("");
      if (restored || restoredCadDrawing) {
        setModelStatus("processing");
        setProgress(`기존 ${isBim ? "3D 모델" : "CAD 도면"}을 다시 불러오고 있습니다.`);
      } else {
        setModelStatus("idle");
        setProgress("");
      }
    });
    return () => { active = false; };
  }, [cadHistoryKey, isBim, modelSessionKey]);

  const api = useCallback(async (pathName: string, options: RequestInit = {}) => {
    if (!backendToken) throw new Error("PROJECT HUB 로그인이 필요합니다.");
    const headers = new Headers(options.headers);
    headers.set("authorization", `Bearer ${backendToken}`);
    if (options.body) headers.set("content-type", "application/json");
    const response = await fetch(`/backend/projects/${selectedProject.id}/${kind}${pathName}`, { ...options, headers });
    if (!response.ok) throw new Error(await responseMessage(response));
    return response;
  }, [backendToken, kind, selectedProject.id]);

  useEffect(() => {
    if (!isBim) return;
    let active = true;
    void (async () => {
      if (auth?.token && !auth.token.startsWith("local:")) {
        setBackendToken(auth.token);
        return;
      }
      try {
        const response = await fetch("/backend/auth/dev-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "partner@projecthub.local" }),
        });
        if (!response.ok) throw new Error();
        const session = await response.json() as { accessToken: string };
        if (active) setBackendToken(session.accessToken);
      } catch {
        if (active) setBackendToken(null);
      }
    })();
    return () => { active = false; };
  }, [auth?.token, isBim]);

  useEffect(() => {
    if (!isBim) {
      queueMicrotask(() => setApsConfigured(null));
      return;
    }
    if (!backendToken) {
      queueMicrotask(() => setApsConfigured(null));
      return;
    }
    let active = true;
    void api("/configuration")
      .then((response) => response.json() as Promise<{ configured: boolean }>)
      .then((configuration) => { if (active) setApsConfigured(configuration.configured); })
      .catch(() => { if (active) setApsConfigured(false); });
    return () => { active = false; };
  }, [api, backendToken, isBim]);

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

  useEffect(() => () => viewer.current?.finish(), []);

  const viewerAccessToken = useCallback(async () => {
    if (!activeModelTicket.current) throw new Error(isBim ? "표시할 3D 모델이 없습니다." : "표시할 CAD 도면이 없습니다.");
    const response = await api(`/viewer-token?ticket=${encodeURIComponent(activeModelTicket.current)}`);
    return response.json() as Promise<{ access_token: string; expires_in: number }>;
  }, [api, isBim]);

  const loadModel = useCallback((nextModel: CadModel) => {
    const autodesk = (window as AutodeskWindow).Autodesk;
    if (!autodesk || !viewerContainer.current) return;
    activeModelTicket.current = nextModel.ticket;
    autodesk.Viewing.Initializer({
      env: "AutodeskProduction2",
      api: "streamingV2",
      getAccessToken(callback) {
        void viewerAccessToken()
          .then((token) => callback(token.access_token, token.expires_in))
          .catch((reason) => setError(reason instanceof Error ? reason.message : "Viewer 토큰을 발급하지 못했습니다."));
      },
    }, () => {
      if (!viewer.current && viewerContainer.current) {
        viewer.current = new autodesk.Viewing.GuiViewer3D(viewerContainer.current, { extensions: [] });
        if (viewer.current.start() !== 0) {
          setError(isBim ? "3D/BIM 뷰어를 시작하지 못했습니다." : "2D CAD 뷰어를 시작하지 못했습니다.");
          return;
        }
      }
      autodesk.Viewing.Document.load(`urn:${nextModel.urn}`, (document) => {
        const root = document.getRoot();
        const sheet = root.search({ type: "geometry", role: isBim ? "3d" : "2d" })[0] ?? root.getDefaultGeometry();
        void viewer.current?.loadDocumentNode(document, sheet)
          .then(() => {
            viewer.current?.fitToView();
            setModelStatus("ready");
            setProgress(isBim ? "변환된 3D 모델을 표시했습니다." : "변환된 2D 도면을 표시했습니다.");
          })
          .catch(() => {
            setModelStatus("failed");
            setError(isBim ? "변환된 3D 모델을 화면에 표시하지 못했습니다." : "변환된 CAD 도면을 화면에 표시하지 못했습니다.");
          });
      }, () => {
        setModelStatus("failed");
        setError(isBim ? "Autodesk에서 변환된 3D 모델을 불러오지 못했습니다." : "Autodesk에서 변환된 도면을 불러오지 못했습니다.");
      });
    });
  }, [isBim, viewerAccessToken]);

  useEffect(() => {
    if (!model || modelStatus !== "processing") return;
    let active = true;
    let timer: number | undefined;
    const check = async () => {
      try {
        const response = await api(`/status?ticket=${encodeURIComponent(model.ticket)}`);
        const result = await response.json() as { status: string; progress: string; messages?: string[] };
        if (!active) return;
        setProgress(`Autodesk 변환 중 · ${result.progress}`);
        if (result.status === "success") {
          if (apsScriptReady) loadModel(model);
          else setProgress(`${isBim ? "3D 모델" : "도면"} 변환 완료 · 뷰어를 준비하고 있습니다.`);
          return;
        }
        if (["failed", "timeout"].includes(result.status)) {
          setModelStatus("failed");
          clearViewerSession(modelSessionKey);
          setError(result.messages?.[0] ?? (isBim ? "Autodesk에서 3D 모델을 변환하지 못했습니다." : "Autodesk에서 CAD 도면을 변환하지 못했습니다."));
          return;
        }
        timer = window.setTimeout(() => void check(), 2000);
      } catch (reason) {
        if (!active) return;
        setModelStatus("failed");
        setError(reason instanceof Error ? reason.message : `${isBim ? "3D 모델" : "CAD"} 변환 상태를 확인하지 못했습니다.`);
      }
    };
    void check();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [api, apsScriptReady, isBim, loadModel, model, modelSessionKey, modelStatus]);

  useEffect(() => {
    if (model && modelStatus === "processing" && apsScriptReady && progress.includes("변환 완료")) {
      loadModel(model);
    }
  }, [apsScriptReady, loadModel, model, modelStatus, progress]);

  const uploadToViewer = useCallback(async (file: File, sourceId: string, modifiedTime: string) => {
    if (!(isBim ? /\.(ifc|obj|stp|step|skp)$/i : /\.(dwg|dxf)$/i).test(file.name)) {
      throw new Error(`${supportedLabel} 파일만 열 수 있습니다.`);
    }
    if (!isBim) throw new Error("내 컴퓨터의 파일은 CAD Viewer for Drive 안에서 직접 열어 주세요.");
    if (!apsConfigured) throw new Error("Autodesk APS 연결 설정이 필요합니다.");
    setBusy(true);
    setError("");
    setNotice("");
    setModelStatus("processing");
    setProgress("Autodesk 업로드를 준비하고 있습니다.");
    try {
      const preparedResponse = await api("/uploads/prepare", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
          sourceId,
          modifiedTime,
        }),
      });
      const prepared = await preparedResponse.json() as { ticket: string; urls: string[]; partSize: number };
      for (let index = 0; index < prepared.urls.length; index += 1) {
        setProgress(`Autodesk로 ${isBim ? "3D 모델" : "도면"} 전송 중 · ${index + 1}/${prepared.urls.length}`);
        const start = index * prepared.partSize;
        const part = file.slice(start, Math.min(start + prepared.partSize, file.size));
        const uploadResponse = await fetch(prepared.urls[index]!, { method: "PUT", body: part });
        if (!uploadResponse.ok) throw new Error(`${isBim ? "3D 모델" : "도면"} 전송이 중단되었습니다. 다시 시도해 주세요.`);
      }
      setProgress(`업로드를 확인하고 ${isBim ? "3D" : "2D"} 변환을 요청하고 있습니다.`);
      const completedResponse = await api("/uploads/complete", {
        method: "POST",
        body: JSON.stringify({ ticket: prepared.ticket }),
      });
      const completed = await completedResponse.json() as CadModel;
      writeViewerSession(modelSessionKey, completed);
      setModel(completed);
      setProgress("Autodesk 변환 대기 중 · 0%");
      setNotice(`${file.name} ${isBim ? "모델" : "도면"}을 뷰어에 추가했습니다.`);
    } catch (reason) {
      setModelStatus("failed");
      throw reason;
    } finally {
      setBusy(false);
    }
  }, [api, apsConfigured, isBim, modelSessionKey, supportedLabel]);

  const clearCurrentCadDrawing = useCallback(() => {
    if (isBim) return;
    clearViewerSession(modelSessionKey);
    setCadDrawing(null);
    setModelStatus("idle");
    setProgress("");
    setError("");
    setNotice("도면을 닫았습니다. 최근 도면 목록에서 다시 열 수 있습니다.");
  }, [isBim, modelSessionKey]);

  const reopenCadDrawing = useCallback((drawing: CadViewerDrawing) => {
    if (isBim) return;
    setError("");
    writeCadDrawingSession(modelSessionKey, drawing);
    setCadDrawing(drawing);
    setModelStatus("processing");
    setProgress("CAD Viewer for Drive에서 최근 도면을 다시 여는 중입니다.");
  }, [isBim, modelSessionKey]);

  const openGoogleItem = useCallback(async (item: GoogleDriveFile) => {
    if (!googleToken) return;
    if (!isSupportedFile(item)) {
      setError(`${supportedLabel} 파일만 뷰어에서 열 수 있습니다.`);
      return;
    }
    if (!isBim) {
      const resolved = resolveDriveItem(item);
      const drawing: CadViewerDrawing = {
        fileName: item.name,
        url: buildCadViewerCoUrl(resolved.id),
        savedAt: Date.now(),
      };
      writeCadDrawingSession(modelSessionKey, drawing);
      setRecentCadDrawings(writeCadDrawingHistory(cadHistoryKey, drawing));
      setCadDrawing(drawing);
      setError("");
      setNotice(`${item.name} 파일을 CAD Viewer for Drive로 열었습니다.`);
      setModelStatus("processing");
      setProgress("CAD Viewer for Drive에 Google Drive 도면을 연결하고 있습니다.");
      return;
    }
    try {
      setProgress(`Google Drive에서 ${isBim ? "3D 모델" : "도면"}을 가져오고 있습니다.`);
      const resolved = resolveDriveItem(item);
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(resolved.id)}?alt=media&supportsAllDrives=true`,
        { headers: { authorization: `Bearer ${googleToken}` } },
      );
      if (!response.ok) throw new Error(`Google Drive에서 ${isBim ? "3D 모델" : "도면"}을 내려받지 못했습니다.`);
      const blob = await response.blob();
      const file = new File([blob], item.name, { type: blob.type || "application/octet-stream" });
      await uploadToViewer(file, item.id, item.modifiedTime ?? "unknown");
    } catch (reason) {
      setModelStatus("failed");
      setError(reason instanceof Error ? reason.message : `${isBim ? "3D 모델" : "CAD 도면"}을 열지 못했습니다.`);
    }
  }, [cadHistoryKey, googleToken, isBim, isSupportedFile, modelSessionKey, supportedLabel, uploadToViewer]);

  const handleViewerDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const localFile = event.dataTransfer.files[0];
    if (localFile) {
      if (!isBim) {
        setError("로컬 파일은 외부 뷰어로 자동 전달할 수 없습니다. CAD Viewer for Drive 화면의 파일 열기 기능을 사용해 주세요.");
        return;
      }
      try {
        await uploadToViewer(localFile, `local:${localFile.name}:${localFile.lastModified}`, String(localFile.lastModified));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : `${isBim ? "3D 모델" : "CAD 도면"}을 열지 못했습니다.`);
      }
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
      {isBim ? <link rel="stylesheet" href={APS_VIEWER_STYLE} /> : null}
      {isBim ? <Script src={APS_VIEWER_SCRIPT} strategy="afterInteractive" onLoad={() => setApsScriptReady(true)} onError={() => setError("Autodesk Viewer 모듈을 불러오지 못했습니다.")} /> : null}
      {googleClientId ? <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGoogleScriptReady(true)} onError={() => setError("Google 연결 모듈을 불러오지 못했습니다.")} /> : null}
      <header className="cad-workspace-title">
        <div>
          <span>{isBim ? "3D BIM WORKSPACE" : "2D CAD WORKSPACE"}</span>
          <h2>{isBim ? "3D/BIM 뷰어" : "CAD 도면"}</h2>
          <p>{isBim ? `Google Drive의 ${supportedLabel} 파일을 끌어 놓아 Autodesk APS 3D 뷰어에서 확인합니다.` : "Google Drive의 DWG·DXF 도면을 끌어 놓아 CAD Viewer for Drive에서 확인합니다."}</p>
        </div>
        <div className="cad-provider-state">
          <i className={isBim ? (apsConfigured ? "ready" : "") : "ready"} />
          {isBim
            ? (apsConfigured === null ? "APS 연결 확인 중" : apsConfigured ? "Autodesk APS 무료 티어 연결" : "APS 설정 필요")
            : "CAD Viewer for Drive 연결"}
        </div>
      </header>
      {error ? <div className="cad-message error" role="alert">{error}<button type="button" onClick={() => setError("")}>닫기</button></div> : null}
      {notice ? <div className="cad-message">{notice}<button type="button" onClick={() => setNotice("")}>닫기</button></div> : null}
      <div className="cad-layout">
        <main className="cad-viewer-panel">
          <div className="cad-viewer-toolbar">
            <div><strong>{isBim ? model?.fileName ?? "3D 모델을 선택해 주세요" : cadDrawing?.fileName ?? "CAD Viewer for Drive"}</strong><span>{progress || (isBim ? `${supportedLabel} 3D 보기` : "cadviewer.co Google Drive Add-on")}</span></div>
            {isBim ? <button type="button" disabled={modelStatus !== "ready"} onClick={() => viewer.current?.fitToView()}>화면 맞춤</button> : null}
            {!isBim ? <button type="button" disabled={!cadDrawing} onClick={clearCurrentCadDrawing}>도면 닫기</button> : null}
            {isBim ? <label className="cad-file-button">내 컴퓨터에서 열기<input type="file" accept={accepts} disabled={busy} onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void uploadToViewer(file, `local:${file.name}:${file.lastModified}`, String(file.lastModified)).catch((reason) => setError(reason instanceof Error ? reason.message : "도면을 열지 못했습니다."));
            }} /></label> : null}
          </div>
          {!isBim && recentCadDrawings.length > 0 ? <div className="cad-recent-drawings" aria-label="최근 도면">
            <strong>최근 도면</strong>
            {recentCadDrawings.map((drawing) => <button type="button" className={cadDrawing?.url === drawing.url ? "active" : ""} onClick={() => reopenCadDrawing(drawing)} key={drawing.url}>{drawing.fileName}</button>)}
          </div> : null}
          <div
            className={`cad-viewer-dropzone${dragging ? " is-dragging" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
            onDrop={(event) => void handleViewerDrop(event)}
          >
            {isBim ? <div className="cad-viewer-canvas" ref={viewerContainer} aria-label="Autodesk APS 3D/BIM 뷰어" /> : <iframe
              className="cad-viewer-external-frame"
              src={cadDrawing?.url ?? buildCadViewerCoUrl()}
              title="CAD Viewer for Google Drive"
              allow="clipboard-read; clipboard-write"
              sandbox="allow-downloads allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
              onLoad={() => {
                setModelStatus("ready");
                setProgress(cadDrawing ? "CAD Viewer for Drive에 도면 열기를 요청했습니다." : "CAD Viewer for Drive를 표시했습니다.");
              }}
            />}
            {isBim && modelStatus === "idle" ? <div className="cad-viewer-empty">
              <span>{supportedLabel.replaceAll("·", " / ")}</span>
              <strong>오른쪽 Google Drive에서 3D 모델을 끌어 놓으세요.</strong>
              <p>회전·이동·확대와 객체 선택 등 Autodesk 기본 3D 탐색 도구를 사용할 수 있습니다.</p>
            </div> : null}
            {isBim && modelStatus === "processing" ? <div className="cad-viewer-loading" role="status"><i /><strong>{progress}</strong><span>파일 크기에 따라 몇 분 정도 걸릴 수 있습니다.</span></div> : null}
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
          <footer><span>{supportedLabel} 원본은 PROJECT HUB 서버에 저장되지 않습니다.</span><small>{isBim ? "PROJECT HUB 권한 확인 → Autodesk APS 서버 변환" : "Google Drive → CAD Viewer for Drive"}</small></footer>
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
