"use client";

import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";

const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";
const ROOT_FOLDER_NAME = "DAWOO GROUP PROJECT HUB";

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

type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  owners?: Array<{ displayName?: string }>;
};
type DriveListResponse = { files?: GoogleDriveFile[] };
type DriveAboutResponse = { storageQuota?: { limit?: string; usage?: string } };

function escapeDriveQuery(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
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

function fileType(file: GoogleDriveFile) {
  if (file.mimeType === GOOGLE_FOLDER_MIME) return "폴더";
  return file.name.split(".").pop()?.toUpperCase().slice(0, 4) || "FILE";
}

async function googleApi<T>(
  accessToken: string,
  url: string,
  options?: RequestInit,
): Promise<T> {
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
  const [scriptReady, setScriptReady] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [rootFolder, setRootFolder] = useState<GoogleDriveFile | null>(null);
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
  const currentFolder = path.at(-1) ?? rootFolder;

  const loadItems = useCallback(
    async (token: string, folderId: string, search: string) => {
      const conditions = [
        `'${escapeDriveQuery(folderId)}' in parents`,
        "trashed = false",
      ];
      if (search.trim())
        conditions.push(`name contains '${escapeDriveQuery(search.trim())}'`);
      const params = new URLSearchParams({
        q: conditions.join(" and "),
        spaces: "drive",
        orderBy: "folder,name_natural",
        pageSize: "200",
        fields:
          "files(id,name,mimeType,size,modifiedTime,webViewLink,owners(displayName))",
      });
      const result = await googleApi<DriveListResponse>(
        token,
        `https://www.googleapis.com/drive/v3/files?${params}`,
      );
      setItems(result.files ?? []);
    },
    [],
  );

  const ensureRootFolder = useCallback(async (token: string) => {
    const params = new URLSearchParams({
      q: `trashed = false and mimeType = '${GOOGLE_FOLDER_MIME}' and appProperties has { key='projectHubRoot' and value='true' }`,
      spaces: "drive",
      pageSize: "1",
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    });
    const existing = await googleApi<DriveListResponse>(
      token,
      `https://www.googleapis.com/drive/v3/files?${params}`,
    );
    if (existing.files?.[0]) return existing.files[0];
    return googleApi<GoogleDriveFile>(
      token,
      "https://www.googleapis.com/drive/v3/files",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: ROOT_FOLDER_NAME,
          mimeType: GOOGLE_FOLDER_MIME,
          appProperties: { projectHubRoot: "true" },
        }),
      },
    );
  }, []);

  const initializeDrive = useCallback(
    async (token: string) => {
      setBusy(true);
      setError("");
      try {
        const [root, about] = await Promise.all([
          ensureRootFolder(token),
          googleApi<DriveAboutResponse>(
            token,
            "https://www.googleapis.com/drive/v3/about?fields=storageQuota(limit,usage)",
          ),
        ]);
        setRootFolder(root);
        setPath([]);
        setQuota(about.storageQuota);
        await loadItems(token, root.id, "");
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
    [ensureRootFolder, loadItems],
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
  }, [clientId, initializeDrive, scriptReady]);

  useEffect(() => {
    if (!accessToken || !currentFolder) return;
    const timer = window.setTimeout(() => {
      void loadItems(accessToken, currentFolder.id, query).catch(
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
  }, [accessToken, currentFolder, loadItems, query]);

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
    tokenClient.current.requestAccessToken({ prompt: "consent" });
  };

  const disconnect = () => {
    if (accessToken && window.google?.accounts)
      window.google.accounts.oauth2.revoke(accessToken);
    setAccessToken("");
    setRootFolder(null);
    setPath([]);
    setItems([]);
    setQuota(undefined);
  };

  const openFolder = async (folder: GoogleDriveFile) => {
    if (!accessToken) return;
    setPath((current) => [...current, folder]);
    setQuery("");
    await loadItems(accessToken, folder.id, "");
  };

  const goPath = async (index: number) => {
    if (!accessToken || !rootFolder) return;
    const nextPath = index < 0 ? [] : path.slice(0, index + 1);
    const target = nextPath.at(-1) ?? rootFolder;
    setPath(nextPath);
    setQuery("");
    await loadItems(accessToken, target.id, "");
  };

  const createFolder = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !currentFolder || !folderName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await googleApi<GoogleDriveFile>(
        accessToken,
        "https://www.googleapis.com/drive/v3/files",
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
      await loadItems(accessToken, currentFolder.id, query);
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
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
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
      await loadItems(accessToken, targetFolderId, query);
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
        `https://www.googleapis.com/drive/v3/files/${item.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
      setNotice("Google Drive 항목의 이름을 변경했습니다.");
      await loadItems(accessToken, currentFolder.id, query);
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
        `https://www.googleapis.com/drive/v3/files/${item.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trashed: true }),
        },
      );
      setNotice("Google Drive 휴지통으로 이동했습니다.");
      await loadItems(accessToken, currentFolder.id, query);
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

  const folders = useMemo(
    () => items.filter((item) => item.mimeType === GOOGLE_FOLDER_MIME),
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

  if (!accessToken || !rootFolder) {
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
          최소 권한인 <b>drive.file</b> 범위만 요청하며 PROJECT HUB에서 만든
          파일과 폴더만 관리합니다. 액세스 토큰은 브라우저 메모리에만
          보관됩니다.
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
          <p>Google Drive의 PROJECT HUB 전용 폴더에서 문서를 관리합니다.</p>
        </div>
        <div className="drive-title-actions">
          <button type="button" onClick={() => openInDrive(rootFolder)}>
            Google Drive에서 열기
          </button>
          <button type="button" onClick={() => setFolderForm((open) => !open)}>
            ＋ 새 폴더
          </button>
          <label className="primary-button file-upload-button">
            {busy && uploadStatus ? "업로드 중..." : "+ 파일 업로드"}
            <input
              aria-label="Google Drive 파일 업로드"
              type="file"
              multiple
              disabled={busy}
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
        Google Drive API 연결 · PROJECT HUB 생성 항목만 접근
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
          <strong>Google Drive 폴더</strong>
          <button
            className={path.length === 0 ? "active" : ""}
            type="button"
            onClick={() => void goPath(-1)}
          >
            ▣ PROJECT HUB
          </button>
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
            <button type="button" onClick={() => void goPath(-1)}>
              PROJECT HUB
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
            busy={busy}
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
                <i
                  className={`file-type ${item.mimeType === GOOGLE_FOLDER_MIME ? "folder" : "google-file"}`}
                >
                  {fileType(item)}
                </i>
                <button
                  className="drive-name"
                  type="button"
                  onClick={() =>
                    item.mimeType === GOOGLE_FOLDER_MIME
                      ? void openFolder(item)
                      : openInDrive(item)
                  }
                >
                  <strong>{item.name}</strong>
                  <small>
                    {item.mimeType === GOOGLE_FOLDER_MIME
                      ? "Google Drive 폴더"
                      : item.mimeType}
                  </small>
                </button>
              </span>
              <span>{item.owners?.[0]?.displayName ?? "내 Google Drive"}</span>
              <span>{dateText(item.modifiedTime)}</span>
              <span>
                {item.mimeType === GOOGLE_FOLDER_MIME
                  ? "-"
                  : sizeText(item.size)}
                <span className="drive-actions">
                  <button type="button" onClick={() => openInDrive(item)}>
                    열기
                  </button>
                  <button type="button" onClick={() => void rename(item)}>
                    이름 변경
                  </button>
                  <button type="button" onClick={() => void moveToTrash(item)}>
                    휴지통
                  </button>
                </span>
              </span>
            </div>
          ))}
          {items.length === 0 ? (
            <div className="workspace-empty">
              <strong>이 폴더가 비어 있습니다.</strong>
              <span>새 폴더를 만들거나 파일을 업로드해 주세요.</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
