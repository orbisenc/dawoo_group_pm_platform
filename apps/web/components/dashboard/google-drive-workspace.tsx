"use client";
/* eslint-disable @next/next/no-img-element -- Google Drive 미리보기는 인증된 임시 object URL을 사용한다. */

import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";

const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";
const GOOGLE_SHORTCUT_MIME = "application/vnd.google-apps.shortcut";
const GOOGLE_MIME_PREFIX = "application/vnd.google-apps.";
const GOOGLE_CONSENT_KEY = "project-hub-google-drive-consent";

type GoogleTokenResponse = {
  access_token?: string;
  error_description?: string;
};
type GoogleTokenClient = {
  requestAccessToken(options?: { prompt?: string }): void;
};
type GoogleAccounts = {
  oauth2: {
    initTokenClient(options: {
      client_id: string;
      scope: string;
      callback(response: GoogleTokenResponse): void;
      error_callback?(error: { message?: string }): void;
    }): GoogleTokenClient;
    revoke(token: string, callback?: () => void): void;
  };
};

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

export type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  parents?: string[];
  owners?: Array<{ displayName?: string }>;
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
  capabilities?: {
    canDownload?: boolean;
    canEdit?: boolean;
    canRename?: boolean;
    canTrash?: boolean;
    canMoveItemWithinDrive?: boolean;
  };
};
type DriveListResponse = { files?: GoogleDriveFile[] };
type SharedDrive = { id: string; name: string; capabilities?: { canAddChildren?: boolean } };
type SharedDriveListResponse = { drives?: SharedDrive[]; nextPageToken?: string };
type DriveAboutResponse = {
  storageQuota?: { limit?: string; usage?: string };
  user?: { displayName?: string; emailAddress?: string };
};
type DriveCategory = "personal" | "shared";
type DrivePreview = { name: string; url: string; kind: "image" | "video" | "audio" | "document"; mimeType: string };

const personalRoot: GoogleDriveFile = {
  id: "root",
  name: "내 드라이브",
  mimeType: GOOGLE_FOLDER_MIME,
  webViewLink: "https://drive.google.com/drive/my-drive",
};

function escapeDriveQuery(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

export function buildGoogleDriveListUrl(folderId: string, search: string, sharedDriveId?: string) {
  const conditions = [`'${escapeDriveQuery(folderId)}' in parents`, "trashed = false"];
  if (search.trim()) conditions.push(`name contains '${escapeDriveQuery(search.trim())}'`);
  const params = new URLSearchParams({
    q: conditions.join(" and "),
    spaces: "drive",
    orderBy: "folder,name_natural",
    pageSize: "200",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    fields: "files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,parents,owners(displayName),shortcutDetails(targetId,targetMimeType),capabilities(canDownload,canEdit,canRename,canTrash,canMoveItemWithinDrive))",
    corpora: sharedDriveId ? "drive" : "user",
  });
  if (sharedDriveId) params.set("driveId", sharedDriveId);
  return `https://www.googleapis.com/drive/v3/files?${params}`;
}

export function resolveDriveItem(item: GoogleDriveFile) {
  const shortcut = item.mimeType === GOOGLE_SHORTCUT_MIME;
  return {
    id: shortcut ? item.shortcutDetails?.targetId ?? item.id : item.id,
    mimeType: shortcut ? item.shortcutDetails?.targetMimeType ?? item.mimeType : item.mimeType,
    shortcut,
  };
}

export function isDriveFolder(item: GoogleDriveFile) {
  return resolveDriveItem(item).mimeType === GOOGLE_FOLDER_MIME;
}

function buildFolderChoicesUrl(sharedDriveId?: string) {
  const params = new URLSearchParams({
    q: `mimeType = '${GOOGLE_FOLDER_MIME}' and trashed = false`,
    spaces: "drive",
    orderBy: "name_natural",
    pageSize: "1000",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    fields: "files(id,name,mimeType,parents)",
    corpora: sharedDriveId ? "drive" : "user",
  });
  if (sharedDriveId) params.set("driveId", sharedDriveId);
  return `https://www.googleapis.com/drive/v3/files?${params}`;
}

function sizeText(value?: string) {
  const bytes = Number(value ?? 0);
  if (!bytes) return "-";
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.ceil(bytes / 1_024))} KB`;
}

function dateText(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

type DriveItemIconKind =
  | "folder"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "cad"
  | "shortcut"
  | "file";

function driveItemIconKind(file: GoogleDriveFile): DriveItemIconKind {
  if (isDriveFolder(file)) return "folder";
  const mimeType = resolveDriveItem(file).mimeType;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (file.mimeType === GOOGLE_SHORTCUT_MIME) return "shortcut";
  if (mimeType === "application/pdf" || extension === "pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/vnd.google-apps.spreadsheet" || ["xls", "xlsx", "csv", "ods"].includes(extension)) return "spreadsheet";
  if (mimeType === "application/vnd.google-apps.presentation" || ["ppt", "pptx", "odp"].includes(extension)) return "presentation";
  if (mimeType === "application/vnd.google-apps.document" || ["doc", "docx", "odt", "rtf", "txt"].includes(extension)) return "document";
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "archive";
  if (["dwg", "dxf", "ifc", "rvt", "skp"].includes(extension)) return "cad";
  return "file";
}

function DriveItemIcon({ file }: { file: GoogleDriveFile }) {
  const kind = driveItemIconKind(file);
  const icon = (() => {
    switch (kind) {
      case "folder":
        return <path d="M3.25 7.25h6l1.9 2h9.6v8.5a2 2 0 0 1-2 2H5.25a2 2 0 0 1-2-2V7.25Zm0 0v-1a2 2 0 0 1 2-2h4l1.8 2h7.7a2 2 0 0 1 2 2v1" />;
      case "image":
        return <><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><circle cx="9" cy="9" r="1.5" /><path d="m5.5 17 4.2-4.2 3 3 2.2-2.2 3.6 3.4" /></>;
      case "video":
        return <><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="m10 9 5 3-5 3V9Z" /></>;
      case "audio":
        return <><path d="M10 18V6.5L18 5v11" /><circle cx="7.5" cy="18" r="2.5" /><circle cx="15.5" cy="16" r="2.5" /></>;
      case "spreadsheet":
        return <><path d="M6 3.5h8l4 4v13H6v-17Z" /><path d="M14 3.5v4h4M8.5 11h7M8.5 14h7M8.5 17h7M11 9.5v9M14 9.5v9" /></>;
      case "presentation":
        return <><path d="M5 4h14v12H5V4Z" /><path d="M9 20h6M12 16v4M9 12V8h6v4H9Z" /></>;
      case "archive":
        return <><path d="M6 3.5h8l4 4v13H6v-17Z" /><path d="M14 3.5v4h4M10 4h3M10 7h3M10 10h3M10 13h3M10 16h3" /></>;
      case "cad":
        return <><path d="m12 3.5 8 4.5v8L12 20.5 4 16V8l8-4.5Z" /><path d="m4 8 8 4.5L20 8M12 12.5v8" /></>;
      case "shortcut":
        return <><path d="M9.5 14.5 14.5 9" /><path d="M8 17H6.5a3.5 3.5 0 0 1 0-7H10M14 7h3.5a3.5 3.5 0 0 1 0 7H14" /></>;
      case "pdf":
      case "document":
      case "file":
      default:
        return <><path d="M6 3.5h8l4 4v13H6v-17Z" /><path d="M14 3.5v4h4M9 12h6M9 15h6M9 18h4" /></>;
    }
  })();

  return (
    <span className={`file-type drive-item-icon ${kind}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
    </span>
  );
}

function exportFormat(mimeType: string) {
  if (mimeType === "application/vnd.google-apps.document") return { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx" };
  if (mimeType === "application/vnd.google-apps.spreadsheet") return { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" };
  if (mimeType === "application/vnd.google-apps.presentation") return { mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", extension: "pptx" };
  if (mimeType === "application/vnd.google-apps.drawing") return { mimeType: "application/pdf", extension: "pdf" };
  return null;
}

function previewKind(mimeType: string): DrivePreview["kind"] | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf" || mimeType.startsWith("text/")) return "document";
  if (exportFormat(mimeType)) return "document";
  return null;
}

async function googleResponse(
  accessToken: string,
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: { authorization: `Bearer ${accessToken}`, ...options?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      response.status === 401
        ? "Google Drive 연결이 만료되었습니다. 다시 연결해 주세요."
        : (body?.error?.message ?? "Google Drive 요청을 처리하지 못했습니다."),
    );
  }
  return response;
}

async function googleApi<T>(
  accessToken: string,
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await googleResponse(accessToken, url, options);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

type GoogleDriveDropzoneProps = {
  busy: boolean;
  uploadStatus?: string;
  onFiles(files: File[]): void;
};

export function GoogleDriveDropzone({
  busy,
  uploadStatus,
  onFiles,
}: GoogleDriveDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length > 0) onFiles(files);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (busy) return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (busy) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (busy) return;
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      className={`google-drive-dropzone${dragging ? " is-dragging" : ""}${busy ? " is-busy" : ""}`}
      onDragEnter={handleDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-busy={busy}
    >
      <div aria-live="polite">
        <strong>
          {dragging
            ? "여기에 파일을 놓아 주세요"
            : "파일을 끌어다 놓아 업로드하세요"}
        </strong>
        <span>
          {uploadStatus ??
            "여러 파일을 한 번에 선택할 수 있으며 현재 Google Drive 폴더에 저장됩니다."}
        </span>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "업로드 중" : "파일 선택"}
      </button>
      <input
        ref={inputRef}
        aria-label="Google Drive 업로드 파일 선택"
        type="file"
        multiple
        disabled={busy}
        onChange={handleChange}
      />
    </div>
  );
}

export function GoogleDriveWorkspace() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
  const tokenClient = useRef<GoogleTokenClient | null>(null);
  const attemptedReconnect = useRef(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [category, setCategory] = useState<DriveCategory>("personal");
  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [selectedSharedDriveId, setSelectedSharedDriveId] = useState("");
  const [path, setPath] = useState<GoogleDriveFile[]>([]);
  const [items, setItems] = useState<GoogleDriveFile[]>([]);
  const [query, setQuery] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderForm, setFolderForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [quota, setQuota] = useState<DriveAboutResponse["storageQuota"]>();
  const [googleUser, setGoogleUser] = useState<DriveAboutResponse["user"]>();
  const [preview, setPreview] = useState<DrivePreview | null>(null);
  const [moveItem, setMoveItem] = useState<GoogleDriveFile | null>(null);
  const [moveTargets, setMoveTargets] = useState<GoogleDriveFile[]>([]);
  const [moveTargetId, setMoveTargetId] = useState("");
  const selectedSharedDrive = sharedDrives.find((drive) => drive.id === selectedSharedDriveId) ?? null;
  const rootFolder = useMemo<GoogleDriveFile | null>(() => category === "personal" ? personalRoot : selectedSharedDrive ? {
    id: selectedSharedDrive.id,
    name: selectedSharedDrive.name,
    mimeType: GOOGLE_FOLDER_MIME,
    webViewLink: `https://drive.google.com/drive/folders/${selectedSharedDrive.id}`,
  } : null, [category, selectedSharedDrive]);
  const currentFolder = path.at(-1) ?? rootFolder;

  const closePreview = useCallback(() => {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const loadItems = useCallback(
    async (token: string, folderId: string, search: string, sharedDriveId?: string) => {
      const result = await googleApi<DriveListResponse>(
        token,
        buildGoogleDriveListUrl(folderId, search, sharedDriveId),
      );
      setItems(result.files ?? []);
    },
    [],
  );

  const initializeDrive = useCallback(
    async (token: string) => {
      setBusy(true);
      setError("");
      try {
        const [driveList, about] = await Promise.all([
          googleApi<SharedDriveListResponse>(
            token,
            "https://www.googleapis.com/drive/v3/drives?pageSize=100&fields=drives(id,name,capabilities(canAddChildren)),nextPageToken",
          ),
          googleApi<DriveAboutResponse>(
            token,
            "https://www.googleapis.com/drive/v3/about?fields=storageQuota(limit,usage),user(displayName,emailAddress)",
          ),
        ]);
        setCategory("personal");
        setSharedDrives(driveList.drives ?? []);
        setSelectedSharedDriveId(driveList.drives?.[0]?.id ?? "");
        setPath([]);
        setQuota(about.storageQuota);
        setGoogleUser(about.user);
        await loadItems(token, personalRoot.id, "");
        window.localStorage.setItem(GOOGLE_CONSENT_KEY, "true");
        setNotice("Google Drive와 연결되었습니다.");
      } catch (reason) {
        setAccessToken("");
        setError(
          reason instanceof Error
            ? reason.message
            : "Google Drive를 초기화하지 못했습니다.",
        );
      } finally {
        setBusy(false);
      }
    },
    [loadItems],
  );

  useEffect(() => {
    if (!scriptReady || !clientId || !window.google?.accounts) return;
    tokenClient.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          setError(
            response.error_description ??
              "Google Drive 권한을 확인하지 못했습니다.",
          );
          return;
        }
        setAccessToken(response.access_token);
        void initializeDrive(response.access_token);
      },
      error_callback: (oauthError) =>
        setError(
          oauthError.message ?? "Google 계정 연결 창을 열지 못했습니다.",
        ),
    });
    if (!attemptedReconnect.current && window.localStorage.getItem(GOOGLE_CONSENT_KEY) === "true") {
      attemptedReconnect.current = true;
      tokenClient.current.requestAccessToken({ prompt: "" });
    }
  }, [clientId, initializeDrive, scriptReady]);

  useEffect(() => {
    if (!accessToken || !currentFolder) return;
    const timer = window.setTimeout(() => {
      void loadItems(accessToken, currentFolder.id, query, category === "shared" ? selectedSharedDriveId : undefined).catch(
        (reason: unknown) => {
          setError(
            reason instanceof Error
              ? reason.message
              : "파일을 불러오지 못했습니다.",
          );
        },
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [accessToken, category, currentFolder, loadItems, query, selectedSharedDriveId]);

  const connect = () => {
    setError("");
    if (!clientId) {
      setError("Google OAuth 클라이언트 ID가 아직 설정되지 않았습니다.");
      return;
    }
    if (!tokenClient.current) {
      setError(
        "Google 인증 모듈을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.",
      );
      return;
    }
    tokenClient.current.requestAccessToken({ prompt: "" });
  };

  const disconnect = () => {
    if (accessToken && window.google?.accounts)
      window.google.accounts.oauth2.revoke(accessToken);
    setAccessToken("");
    window.localStorage.removeItem(GOOGLE_CONSENT_KEY);
    setCategory("personal");
    setSharedDrives([]);
    setSelectedSharedDriveId("");
    setPath([]);
    setItems([]);
    setQuota(undefined);
    setGoogleUser(undefined);
  };

  const openFolder = async (folder: GoogleDriveFile) => {
    if (!accessToken) return;
    const target = resolveDriveItem(folder);
    const resolvedFolder = { ...folder, id: target.id, mimeType: target.mimeType };
    setPath((current) => [...current, resolvedFolder]);
    setQuery("");
    await loadItems(accessToken, target.id, "", category === "shared" ? selectedSharedDriveId : undefined);
  };

  const goPath = async (index: number) => {
    if (!accessToken || !rootFolder) return;
    const nextPath = index < 0 ? [] : path.slice(0, index + 1);
    const target = nextPath.at(-1) ?? rootFolder;
    setPath(nextPath);
    setQuery("");
    await loadItems(accessToken, target.id, "", category === "shared" ? selectedSharedDriveId : undefined);
  };

  const selectCategory = async (nextCategory: DriveCategory, driveId?: string) => {
    if (!accessToken) return;
    setCategory(nextCategory);
    setPath([]);
    setQuery("");
    if (nextCategory === "personal") {
      await loadItems(accessToken, personalRoot.id, "");
      return;
    }
    const nextDriveId = driveId ?? selectedSharedDriveId ?? sharedDrives[0]?.id;
    if (!nextDriveId) {
      setItems([]);
      return;
    }
    setSelectedSharedDriveId(nextDriveId);
    await loadItems(accessToken, nextDriveId, "", nextDriveId);
  };

  const createFolder = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !currentFolder || !folderName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await googleApi<GoogleDriveFile>(
        accessToken,
        "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: folderName.trim(),
            mimeType: GOOGLE_FOLDER_MIME,
            parents: [currentFolder.id],
          }),
        },
      );
      setFolderName("");
      setFolderForm(false);
      setNotice("Google Drive에 새 폴더를 만들었습니다.");
      await loadItems(accessToken, currentFolder.id, query, category === "shared" ? selectedSharedDriveId : undefined);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "폴더를 만들지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0 || !accessToken || !currentFolder || busy) return;
    const targetFolderId = currentFolder.id;
    setBusy(true);
    setError("");
    setNotice("");
    const failures: string[] = [];
    let uploadedCount = 0;

    for (const [index, file] of files.entries()) {
      setUploadStatus(`${index + 1}/${files.length} · ${file.name} 업로드 중`);
      try {
        const sessionResponse = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${accessToken}`,
              "content-type": "application/json; charset=UTF-8",
              "x-upload-content-type": file.type || "application/octet-stream",
              "x-upload-content-length": String(file.size),
            },
            body: JSON.stringify({
              name: file.name,
              parents: [targetFolderId],
            }),
          },
        );
        if (!sessionResponse.ok) throw new Error("업로드 준비에 실패했습니다.");
        const uploadUrl = sessionResponse.headers.get("location");
        if (!uploadUrl) throw new Error("업로드 주소를 받지 못했습니다.");
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!uploadResponse.ok) throw new Error("파일 전송에 실패했습니다.");
        uploadedCount += 1;
      } catch {
        failures.push(file.name);
      }
    }

    try {
      await loadItems(accessToken, targetFolderId, query, category === "shared" ? selectedSharedDriveId : undefined);
      if (uploadedCount > 0)
        setNotice(
          `${uploadedCount}개 파일을 현재 Google Drive 폴더에 업로드했습니다.`,
        );
      if (failures.length > 0)
        setError(
          `${failures.length}개 파일을 업로드하지 못했습니다: ${failures.join(", ")}`,
        );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "업로드 후 파일 목록을 갱신하지 못했습니다.",
      );
    } finally {
      setUploadStatus("");
      setBusy(false);
    }
  };

  const rename = async (item: GoogleDriveFile) => {
    if (!accessToken || !currentFolder) return;
    const name = window.prompt("새 이름을 입력하세요.", item.name)?.trim();
    if (!name || name === item.name) return;
    try {
      await googleApi<GoogleDriveFile>(
        accessToken,
        `https://www.googleapis.com/drive/v3/files/${item.id}?supportsAllDrives=true`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
      setNotice("Google Drive 항목의 이름을 변경했습니다.");
      await loadItems(accessToken, currentFolder.id, query, category === "shared" ? selectedSharedDriveId : undefined);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "이름을 변경하지 못했습니다.",
      );
    }
  };

  const moveToTrash = async (item: GoogleDriveFile) => {
    if (!accessToken || !currentFolder) return;
    if (
      !window.confirm(
        `'${item.name}'을(를) Google Drive 휴지통으로 이동할까요?`,
      )
    )
      return;
    try {
      await googleApi<GoogleDriveFile>(
        accessToken,
        `https://www.googleapis.com/drive/v3/files/${item.id}?supportsAllDrives=true`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trashed: true }),
        },
      );
      setNotice("Google Drive 휴지통으로 이동했습니다.");
      await loadItems(accessToken, currentFolder.id, query, category === "shared" ? selectedSharedDriveId : undefined);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "항목을 이동하지 못했습니다.",
      );
    }
  };

  const openInDrive = (item: GoogleDriveFile) => {
    window.open(
      item.webViewLink ?? `https://drive.google.com/open?id=${item.id}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const refreshCurrentFolder = async () => {
    if (!accessToken || !currentFolder) return;
    setBusy(true);
    setError("");
    try {
      await loadItems(accessToken, currentFolder.id, query, category === "shared" ? selectedSharedDriveId : undefined);
      setNotice("Google Drive의 최신 내용을 불러왔습니다.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "파일 목록을 새로고침하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const previewItem = async (item: GoogleDriveFile) => {
    if (!accessToken) return;
    const target = resolveDriveItem(item);
    if (target.mimeType === GOOGLE_FOLDER_MIME) {
      await openFolder(item);
      return;
    }
    const kind = previewKind(target.mimeType);
    if (!kind) {
      setError("이 파일 형식은 화면 미리보기를 지원하지 않습니다. 다운로드하거나 Google 편집기에서 열어 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const isGoogleDocument = Boolean(exportFormat(target.mimeType));
      const url = isGoogleDocument
        ? `https://www.googleapis.com/drive/v3/files/${target.id}/export?mimeType=${encodeURIComponent("application/pdf")}`
        : `https://www.googleapis.com/drive/v3/files/${target.id}?alt=media&supportsAllDrives=true`;
      const response = await googleResponse(accessToken, url);
      const blob = await response.blob();
      const effectiveMimeType = isGoogleDocument ? "application/pdf" : blob.type || target.mimeType;
      closePreview();
      setPreview({ name: item.name, url: URL.createObjectURL(blob), kind: previewKind(effectiveMimeType) ?? "document", mimeType: effectiveMimeType });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "파일 미리보기를 열지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const downloadItem = async (item: GoogleDriveFile) => {
    if (!accessToken || item.capabilities?.canDownload === false) return;
    const target = resolveDriveItem(item);
    const format = exportFormat(target.mimeType);
    if (target.mimeType.startsWith(GOOGLE_MIME_PREFIX) && !format) {
      setError("이 Google 파일 형식은 직접 다운로드를 지원하지 않습니다. Google 편집기에서 내보내 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const url = format
        ? `https://www.googleapis.com/drive/v3/files/${target.id}/export?mimeType=${encodeURIComponent(format.mimeType)}`
        : `https://www.googleapis.com/drive/v3/files/${target.id}?alt=media&supportsAllDrives=true`;
      const response = await googleResponse(accessToken, url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = format ? `${item.name}.${format.extension}` : item.name;
      link.click();
      URL.revokeObjectURL(objectUrl);
      setNotice(`'${item.name}' 다운로드를 시작했습니다.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "파일을 다운로드하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const startMove = async (item: GoogleDriveFile) => {
    if (!accessToken || !rootFolder) return;
    setBusy(true);
    setError("");
    try {
      const result = await googleApi<DriveListResponse>(accessToken, buildFolderChoicesUrl(category === "shared" ? selectedSharedDriveId : undefined));
      setMoveTargets((result.files ?? []).filter((folder) => folder.id !== item.id));
      setMoveTargetId(rootFolder.id);
      setMoveItem(item);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "이동할 폴더 목록을 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const submitMove = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !currentFolder || !moveItem || !moveTargetId) return;
    const params = new URLSearchParams({ supportsAllDrives: "true", addParents: moveTargetId });
    const previousParent = moveItem.parents?.[0] ?? currentFolder.id;
    if (previousParent) params.set("removeParents", previousParent);
    setBusy(true);
    setError("");
    try {
      await googleApi<GoogleDriveFile>(accessToken, `https://www.googleapis.com/drive/v3/files/${moveItem.id}?${params}`, { method: "PATCH" });
      setNotice(`'${moveItem.name}'을(를) 이동했습니다.`);
      setMoveItem(null);
      await loadItems(accessToken, currentFolder.id, query, category === "shared" ? selectedSharedDriveId : undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "항목을 이동하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const folders = useMemo(
    () => items.filter(isDriveFolder),
    [items],
  );
  const quotaPercent = quota?.limit
    ? Math.min(100, (Number(quota.usage ?? 0) / Number(quota.limit)) * 100)
    : 0;

  if (!clientId) {
    return (
      <section className="google-drive-setup">
        <span>GOOGLE DRIVE API</span>
        <h2>Google Drive 연동 준비</h2>
        <p>
          Google Cloud OAuth 클라이언트 ID를 설정하면 사용자의 비밀번호를
          저장하지 않고 전용 폴더를 연결할 수 있습니다.
        </p>
        <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>
        <button type="button" onClick={connect}>
          설정 확인
        </button>
        {error ? <div role="alert">{error}</div> : null}
      </section>
    );
  }

  if (!accessToken) {
    return (
      <section className="google-drive-setup">
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
        />
        <span>GOOGLE DRIVE API</span>
        <h2>Google Drive 연결</h2>
        <p>
          내 드라이브와 참여 중인 공유 드라이브를 한 화면에서 사용합니다.
          처음 한 번 Google 권한을 승인하면 이후에는 브라우저의 로그인 계정으로
          자동 재연결을 시도합니다. 액세스 토큰은 브라우저 메모리에만 보관됩니다.
        </p>
        <button type="button" onClick={connect} disabled={busy || !scriptReady}>
          {busy ? "연결 중..." : "Google 계정으로 연결"}
        </button>
        {error ? <div role="alert">{error}</div> : null}
      </section>
    );
  }

  return (
    <section className="database-drive google-drive-workspace">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <header className="drive-title">
        <div>
          <span className="sample-label">
            <i /> Google Drive 연결됨
          </span>
          <h2>공유 드라이브</h2>
          <p>{googleUser?.emailAddress ? `${googleUser.emailAddress} 계정의 ` : ""}실제 Google Drive 파일을 관리합니다.</p>
        </div>
        <div className="drive-title-actions">
          <button type="button" disabled={busy || !currentFolder} onClick={() => void refreshCurrentFolder()}>
            새로고침
          </button>
          <button type="button" disabled={!currentFolder} onClick={() => setFolderForm((open) => !open)}>
            ＋ 새 폴더
          </button>
          <label className="primary-button file-upload-button">
            {busy && uploadStatus ? "업로드 중..." : "+ 파일 업로드"}
            <input
              aria-label="Google Drive 파일 업로드"
              type="file"
              multiple
              disabled={busy || !currentFolder}
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? []);
                event.currentTarget.value = "";
                if (files.length > 0) void uploadFiles(files);
              }}
            />
          </label>
          <button type="button" onClick={disconnect}>
            연결 해제
          </button>
        </div>
      </header>
      <div className="drive-mode">
        Google Drive API 연결 · 개인 드라이브와 공유 드라이브 실시간 동기화
      </div>
      {error ? (
        <div className="db-feed-error" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="drive-notice">
          {notice}
          <button type="button" onClick={() => setNotice("")}>
            닫기
          </button>
        </div>
      ) : null}
      {folderForm ? (
        <form className="drive-folder-form" onSubmit={createFolder}>
          <input
            aria-label="Google Drive 새 폴더 이름"
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder="폴더 이름"
            maxLength={120}
            required
          />
          <button type="submit" disabled={busy}>
            만들기
          </button>
          <button type="button" onClick={() => setFolderForm(false)}>
            취소
          </button>
        </form>
      ) : null}
      <div className="drive-layout">
        <aside className="folder-tree">
          <strong>Google Drive</strong>
          <div className="google-drive-categories" aria-label="Google Drive 카테고리">
            <button className={category === "personal" ? "active" : ""} type="button" onClick={() => void selectCategory("personal")}>
              <span>개인 드라이브</span><small>내 드라이브</small>
            </button>
            <button className={category === "shared" ? "active" : ""} type="button" onClick={() => void selectCategory("shared")}>
              <span>공유 드라이브</span><small>{sharedDrives.length}개</small>
            </button>
          </div>
          {category === "shared" ? <div className="shared-drive-list">
            {sharedDrives.map((drive) => <button className={selectedSharedDriveId === drive.id && path.length === 0 ? "active" : ""} type="button" onClick={() => void selectCategory("shared", drive.id)} key={drive.id}>▣ {drive.name}</button>)}
            {sharedDrives.length === 0 ? <p>참여 중인 공유 드라이브가 없습니다.</p> : null}
          </div> : <button className={path.length === 0 ? "active" : ""} type="button" onClick={() => void goPath(-1)}>▣ 내 드라이브</button>}
          {folders.map((folder) => (
            <button
              type="button"
              onClick={() => void openFolder(folder)}
              key={folder.id}
            >
              ▸ {folder.name}
            </button>
          ))}
          <div className="drive-usage">
            <span>Google Drive 사용량</span>
            <div>
              <i style={{ width: `${quotaPercent}%` }} />
            </div>
            <small>
              {sizeText(quota?.usage)} /{" "}
              {quota?.limit ? sizeText(quota.limit) : "용량 정보 없음"}
            </small>
          </div>
        </aside>
        <div className="drive-content">
          <div className="breadcrumb">
            <button type="button" disabled={!rootFolder} onClick={() => void goPath(-1)}>
              {rootFolder?.name ?? "공유 드라이브"}
            </button>
            {path.map((folder, index) => (
              <span key={folder.id}>
                <b>/</b>
                <button type="button" onClick={() => void goPath(index)}>
                  {folder.name}
                </button>
              </span>
            ))}
            <input
              aria-label="Google Drive 파일 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="현재 폴더 검색"
            />
          </div>
          <GoogleDriveDropzone
            busy={busy || !currentFolder}
            uploadStatus={uploadStatus || undefined}
            onFiles={(files) => void uploadFiles(files)}
          />
          <div className="data-head file-columns">
            <span>이름</span>
            <span>소유자</span>
            <span>수정일</span>
            <span>크기 / 작업</span>
          </div>
          {items.map((item) => (
            <div className="data-row file-columns drive-row" key={item.id}>
              <span>
                <DriveItemIcon file={item} />
                <button
                  className="drive-name"
                  type="button"
                  onClick={() => void previewItem(item)}
                >
                  <strong className="google-drive-item-name">{item.name}</strong>
                </button>
              </span>
              <span>{item.owners?.[0]?.displayName ?? (category === "shared" ? selectedSharedDrive?.name : googleUser?.displayName ?? "내 Google Drive")}</span>
              <span>{dateText(item.modifiedTime)}</span>
              <span>
                {isDriveFolder(item)
                  ? "-"
                  : sizeText(item.size)}
                <span className="drive-actions">
                  <button type="button" onClick={() => void previewItem(item)}>
                    {isDriveFolder(item) ? "폴더 열기" : "미리보기"}
                  </button>
                  {!isDriveFolder(item) && item.capabilities?.canDownload !== false ? <button type="button" onClick={() => void downloadItem(item)}>
                    다운로드
                  </button> : null}
                  {item.capabilities?.canMoveItemWithinDrive !== false ? <button type="button" onClick={() => void startMove(item)}>
                    이동
                  </button> : null}
                  {item.capabilities?.canRename !== false ? <button type="button" onClick={() => void rename(item)}>
                    이름 변경
                  </button> : null}
                  {item.capabilities?.canTrash !== false ? <button type="button" onClick={() => void moveToTrash(item)}>
                    휴지통
                  </button> : null}
                  {!isDriveFolder(item) && item.webViewLink ? <button type="button" onClick={() => openInDrive(item)}>
                    Google 편집기
                  </button> : null}
                </span>
              </span>
            </div>
          ))}
          {items.length === 0 ? (
            <div className="workspace-empty">
              <strong>{category === "shared" && !selectedSharedDrive ? "참여 중인 공유 드라이브가 없습니다." : "이 폴더가 비어 있습니다."}</strong>
              <span>{category === "shared" && !selectedSharedDrive ? "Google Workspace에서 공유 드라이브에 참여하면 여기에 표시됩니다." : "새 폴더를 만들거나 파일을 업로드해 주세요."}</span>
            </div>
          ) : null}
        </div>
      </div>
      {moveItem ? <div className="google-drive-dialog" role="dialog" aria-modal="true" aria-label={`${moveItem.name} 이동`}>
        <form onSubmit={submitMove}>
          <div><strong>항목 이동</strong><button type="button" aria-label="이동 창 닫기" onClick={() => setMoveItem(null)}>×</button></div>
          <p><b>{moveItem.name}</b>을(를) 이동할 폴더를 선택하세요.</p>
          <label><span>대상 폴더</span><select aria-label="이동할 Google Drive 폴더" value={moveTargetId} onChange={(event) => setMoveTargetId(event.target.value)}>
            {rootFolder ? <option value={rootFolder.id}>{rootFolder.name}</option> : null}
            {moveTargets.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}
          </select></label>
          <footer><button type="button" onClick={() => setMoveItem(null)}>취소</button><button className="primary-button" type="submit" disabled={busy || !moveTargetId}>이동</button></footer>
        </form>
      </div> : null}
      {preview ? <div className="google-drive-preview" role="dialog" aria-modal="true" aria-label={`${preview.name} 미리보기`}>
        <div><strong>{preview.name}</strong><button type="button" aria-label="미리보기 닫기" onClick={closePreview}>×</button></div>
        {preview.kind === "image" ? <img src={preview.url} alt={preview.name} /> : null}
        {preview.kind === "video" ? <video src={preview.url} controls aria-label={preview.name} /> : null}
        {preview.kind === "audio" ? <audio src={preview.url} controls aria-label={preview.name} /> : null}
        {preview.kind === "document" ? <iframe src={preview.url} title={`${preview.name} 문서 미리보기`} /> : null}
      </div> : null}
    </section>
  );
}
