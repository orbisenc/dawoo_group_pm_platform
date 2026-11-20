"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type React from "react";
import Image from "next/image";

const projectId = process.env.NEXT_PUBLIC_DEMO_PROJECT_ID ?? "30000000-0000-4000-8000-000000000001";
const groupId = process.env.NEXT_PUBLIC_DEMO_GROUP_ID ?? "40000000-0000-4000-8000-000000000001";
const storageKey = `project-hub:drive:v2:${projectId}`;
const allowed = ".dwg,.dxf,.ifc,.rvt,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.zip";

type FolderAccess = { groupId: string; canWrite: boolean; group?: { name: string } };
type Folder = { id: string; parentId: string | null; name: string; isRestricted: boolean; createdAt: string; updatedAt: string; createdBy?: { name: string }; groupAccess?: FolderAccess[] };
type Version = { id: string; version: number; originalName: string; mimeType: string; size: string; sha256?: string; createdAt: string; uploadedBy?: { name: string }; dataUrl?: string };
type IssueLink = { id: string; post: { id: string; title: string; groupId: string } };
type DriveFile = { id: string; folderId: string | null; name: string; createdAt: string; updatedAt: string; createdBy?: { name: string }; versions: Version[]; issueLinks?: IssueLink[] };
type Store = { folders: Folder[]; files: DriveFile[] };
type Mode = "loading" | "api" | "local";
type Group = { id: string; name: string };
type Issue = { id: string; title: string };
type UploadTask = { id: string; name: string; progress: number; status: "uploading" | "failed" | "done"; message?: string; file: File; target?: DriveFile; destinationId?: string | null };
type Preview = { name: string; url: string; mimeType: string };

function localStore(): Store {
  try { const saved = window.localStorage.getItem(storageKey); if (saved) return JSON.parse(saved) as Store; } catch { /* 손상된 저장 데이터는 초기화한다. */ }
  const store: Store = { folders: [], files: [] }; window.localStorage.setItem(storageKey, JSON.stringify(store)); return store;
}
function saveLocal(store: Store) { window.localStorage.setItem(storageKey, JSON.stringify(store)); }
function uid() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
function dataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("파일을 읽지 못했습니다.")); reader.readAsDataURL(file); }); }
async function sha256File(file: File) { const bytes = typeof file.arrayBuffer === "function" ? await file.arrayBuffer() : await new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = () => reject(new Error("파일 해시를 계산하지 못했습니다.")); reader.readAsArrayBuffer(file); }); if (!globalThis.crypto?.subtle) throw new Error("이 브라우저에서는 파일 무결성 해시를 계산할 수 없습니다."); const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes); return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
function uploadWithProgress(url: string, headers: Record<string, string>, file: File, progress: (value: number) => void) { return new Promise<void>((resolve, reject) => { const request = new XMLHttpRequest(); request.open("PUT", url); Object.entries(headers).forEach(([key, value]) => request.setRequestHeader(key, value)); request.upload.onprogress = (event) => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)); }; request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`스토리지 응답 ${request.status}`)); request.onerror = () => reject(new Error("네트워크 연결이 끊어졌습니다.")); request.send(file); }); }
function sizeText(size: string) { const bytes = Number(size); return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`; }
function fileType(name: string) { return name.split(".").pop()?.toUpperCase().slice(0, 4) || "FILE"; }
function dateText(value: string) { return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value)); }

async function api<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/backend${path}`, { ...options, headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...options?.headers } });
  if (!response.ok) { const body = await response.json().catch(() => null) as { message?: string | string[] } | null; throw new Error(Array.isArray(body?.message) ? body.message.join(" ") : body?.message ?? "요청을 처리하지 못했습니다."); }
  return response.json() as Promise<T>;
}

export function DatabaseDriveWorkspace() {
  const [mode, setMode] = useState<Mode>("local");
  const [token, setToken] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [rootFolders, setRootFolders] = useState<Folder[]>([]);
  const [path, setPath] = useState<Folder[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [folderForm, setFolderForm] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [restricted, setRestricted] = useState(false);
  const [groups, setGroups] = useState<Group[]>([{ id: groupId, name: "설계·시공 협업 그룹" }]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState("");
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [versionFile, setVersionFile] = useState<DriveFile | null>(null);
  const currentId = path.at(-1)?.id ?? null;

  const loadLocal = useCallback((parentId: string | null, search: string) => {
    const store = localStore(); const lowered = search.trim().toLowerCase();
    setRootFolders(store.folders.filter((folder) => folder.parentId === null));
    setFolders(store.folders.filter((folder) => lowered ? folder.name.toLowerCase().includes(lowered) : folder.parentId === parentId));
    setFiles(store.files.filter((file) => lowered ? file.name.toLowerCase().includes(lowered) : file.folderId === parentId));
  }, []);

  const loadApi = useCallback(async (accessToken: string, parentId: string | null, search: string) => {
    const params = new URLSearchParams(); if (parentId && !search) params.set("parentId", parentId); if (search.trim()) params.set("query", search.trim());
    const result = await api<{ folders: Folder[]; files: DriveFile[] }>(`/projects/${projectId}/drive?${params}`, accessToken); setFolders(result.folders); setFiles(result.files);
    if (!parentId && !search) setRootFolders(result.folders);
  }, []);

  const refresh = useCallback(async (search: string) => { if (mode === "local") loadLocal(currentId, search); else if (mode === "api") await loadApi(token, currentId, search); }, [currentId, loadApi, loadLocal, mode, token]);

  useEffect(() => { let active = true; void (async () => { try { const response = await fetch("/backend/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "partner@projecthub.local" }) }); if (!response.ok) throw new Error(); const session = await response.json() as { accessToken: string }; if (!active) return; const projectGroups = await api<Group[]>(`/projects/${projectId}/groups`, session.accessToken); setToken(session.accessToken); setGroups(projectGroups); setMode("api"); await loadApi(session.accessToken, null, ""); } catch { if (!active) return; setMode("local"); loadLocal(null, ""); } })(); return () => { active = false; }; }, [loadApi, loadLocal]);
  useEffect(() => { if (mode === "loading") return; const timer = window.setTimeout(() => void refresh(query).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "파일을 불러오지 못했습니다.")), 180); return () => window.clearTimeout(timer); }, [mode, query, refresh]);

  const openFolder = async (folder: Folder) => { setQuery(""); setPath((current) => [...current, folder]); if (mode !== "api") loadLocal(folder.id, ""); else await loadApi(token, folder.id, ""); };
  const goPath = async (index: number) => { const next = index < 0 ? [] : path.slice(0, index + 1); setPath(next); setQuery(""); const id = next.at(-1)?.id ?? null; if (mode !== "api") loadLocal(id, ""); else await loadApi(token, id, ""); };

  const createFolder = async (event: FormEvent) => { event.preventDefault(); if (!folderName.trim()) return; setBusy(true); setError(""); try { const groupIds = selectedGroupId ? [selectedGroupId] : []; if (mode === "local") { const store = localStore(); if (store.folders.some((folder) => folder.parentId === currentId && folder.name.toLowerCase() === folderName.trim().toLowerCase())) throw new Error("같은 위치에 동일한 폴더가 있습니다."); store.folders.push({ id: uid(), parentId: currentId, name: folderName.trim(), isRestricted: restricted, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: { name: "김지훈" }, groupAccess: groupIds.map((id) => ({ groupId: id, canWrite: true, group: { name: groups.find((group) => group.id === id)?.name ?? "협업 그룹" } })) }); saveLocal(store); } else await api(`/projects/${projectId}/drive/folders`, token, { method: "POST", body: JSON.stringify({ name: folderName, parentId: currentId ?? undefined, isRestricted: restricted, groupIds }) }); setFolderName(""); setRestricted(false); setSelectedGroupId(""); setFolderForm(false); setNotice("새 폴더를 만들었습니다."); await refresh(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "폴더를 만들지 못했습니다."); } finally { setBusy(false); } };

  const upload = async (file: File | undefined, target?: DriveFile, destinationId: string | null = currentId) => {
    if (!file) return;
    const taskId = uid();
    const updateTask = (patch: Partial<UploadTask>) => setUploadTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...patch } : task));
    setUploadTasks((current) => [...current.filter((task) => task.status !== "done"), { id: taskId, name: file.name, progress: 0, status: "uploading", file, target, destinationId }]);
    setBusy(true); setError("");
    try {
      const sha256 = await sha256File(file);
      if (mode === "local") {
        if (file.size > 2 * 1024 * 1024) throw new Error("로컬 저장 모드는 파일당 2MB까지 지원합니다. Docker API를 실행하면 1GB까지 업로드할 수 있습니다.");
        const store = localStore(); const encoded = await dataUrl(file); const timestamp = new Date().toISOString();
        if (target) { const found = store.files.find((item) => item.id === target.id); if (!found) throw new Error("파일을 찾을 수 없습니다."); found.versions.unshift({ id: uid(), version: (found.versions[0]?.version ?? 0) + 1, originalName: file.name, mimeType: file.type || "application/octet-stream", size: String(file.size), sha256, createdAt: timestamp, uploadedBy: { name: "김지훈" }, dataUrl: encoded }); found.updatedAt = timestamp; }
        else store.files.unshift({ id: uid(), folderId: destinationId, name: file.name, createdAt: timestamp, updatedAt: timestamp, createdBy: { name: "김지훈" }, versions: [{ id: uid(), version: 1, originalName: file.name, mimeType: file.type || "application/octet-stream", size: String(file.size), sha256, createdAt: timestamp, uploadedBy: { name: "김지훈" }, dataUrl: encoded }], issueLinks: [] });
        saveLocal(store); updateTask({ progress: 100 });
      } else {
        const prepared = await api<{ file: { id: string }; version: { id: string }; upload: { url: string; headers: Record<string, string> } }>(`/projects/${projectId}/drive/files/prepare`, token, { method: "POST", body: JSON.stringify({ fileId: target?.id, folderId: target ? undefined : destinationId ?? undefined, originalName: file.name, mimeType: file.type || "application/octet-stream", size: file.size, sha256 }) });
        let lastFailure: unknown;
        for (let attempt = 1; attempt <= 3; attempt += 1) { try { await uploadWithProgress(prepared.upload.url, prepared.upload.headers, file, (progress) => updateTask({ progress })); lastFailure = undefined; break; } catch (reason) { lastFailure = reason; if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, attempt * 500)); } }
        if (lastFailure) throw lastFailure;
        await api(`/projects/${projectId}/drive/files/${prepared.file.id}/versions/${prepared.version.id}/complete`, token, { method: "POST" });
      }
      updateTask({ status: "done", progress: 100 }); setNotice(target ? "새 파일 버전을 등록했습니다." : "파일을 업로드했습니다."); setVersionFile(null); await refresh("");
    } catch (reason) { const message = reason instanceof Error ? reason.message : "파일을 업로드하지 못했습니다."; updateTask({ status: "failed", message }); setError(message); }
    finally { setBusy(false); }
  };

  const rename = async (kind: "folder" | "file", item: Folder | DriveFile) => { const name = window.prompt("새 이름을 입력하세요.", item.name)?.trim(); if (!name || name === item.name) return; try { if (mode === "local") { const store = localStore(); const target = kind === "folder" ? store.folders.find((entry) => entry.id === item.id) : store.files.find((entry) => entry.id === item.id); if (target) { target.name = name; target.updatedAt = new Date().toISOString(); } saveLocal(store); } else await api(`/projects/${projectId}/drive/${kind === "folder" ? "folders" : "files"}/${item.id}`, token, { method: "PATCH", body: JSON.stringify({ name }) }); setNotice("이름을 변경했습니다."); await refresh(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "이름을 변경하지 못했습니다."); } };
  const remove = async (kind: "folder" | "file", item: Folder | DriveFile) => { if (!window.confirm(`‘${item.name}’을(를) 삭제할까요?`)) return; try { if (mode === "local") { const store = localStore(); if (kind === "folder" && (store.folders.some((folder) => folder.parentId === item.id) || store.files.some((file) => file.folderId === item.id))) throw new Error("비어 있지 않은 폴더는 삭제할 수 없습니다."); if (kind === "folder") store.folders = store.folders.filter((entry) => entry.id !== item.id); else store.files = store.files.filter((entry) => entry.id !== item.id); saveLocal(store); } else await api(`/projects/${projectId}/drive/${kind === "folder" ? "folders" : "files"}/${item.id}`, token, { method: "DELETE" }); setNotice("삭제했습니다."); await refresh(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "삭제하지 못했습니다."); } };
  const download = async (file: DriveFile) => { try { const latest = file.versions[0]; if (mode === "local") { if (!latest?.dataUrl) throw new Error("샘플 파일은 화면 표시용이며 실제 원본이 없습니다."); const link = document.createElement("a"); link.href = latest.dataUrl; link.download = file.name; link.click(); } else { const result = await api<{ url: string }>(`/projects/${projectId}/drive/files/${file.id}/download`, token); window.location.assign(result.url); } } catch (reason) { setError(reason instanceof Error ? reason.message : "파일을 내려받지 못했습니다."); } };
  const moveItem = async (kind: "folder" | "file", id: string, destinationId: string | null) => { try { if (kind === "folder" && id === destinationId) return; if (mode === "local") { const store = localStore(); if (kind === "folder") { const item = store.folders.find((folder) => folder.id === id); if (!item) return; let parent = destinationId; while (parent) { if (parent === id) throw new Error("하위 폴더 안으로 이동할 수 없습니다."); parent = store.folders.find((folder) => folder.id === parent)?.parentId ?? null; } item.parentId = destinationId; } else { const item = store.files.find((file) => file.id === id); if (item) item.folderId = destinationId; } saveLocal(store); } else await api(`/projects/${projectId}/drive/${kind === "folder" ? "folders" : "files"}/${id}`, token, { method: "PATCH", body: JSON.stringify(kind === "folder" ? { parentId: destinationId } : { folderId: destinationId }) }); setNotice("항목을 이동했습니다."); await refresh(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "항목을 이동하지 못했습니다."); } };
  const handleDrop = async (event: React.DragEvent, destinationId: string | null) => { event.preventDefault(); event.stopPropagation(); setDragging(false); const internal = event.dataTransfer.getData("application/x-project-hub-drive"); if (internal) { const item = JSON.parse(internal) as { kind: "folder" | "file"; id: string }; await moveItem(item.kind, item.id, destinationId); return; } for (const file of Array.from(event.dataTransfer.files)) await upload(file, undefined, destinationId); };
  const previewFile = async (file: DriveFile) => { try { const latest = file.versions[0]; if (!latest || (latest.mimeType !== "application/pdf" && !latest.mimeType.startsWith("image/"))) throw new Error("PDF와 이미지만 미리 볼 수 있습니다."); if (mode === "local") { if (!latest.dataUrl) throw new Error("샘플 파일은 실제 원본이 없어 미리 볼 수 없습니다."); setPreview({ name: file.name, url: latest.dataUrl, mimeType: latest.mimeType }); } else { const result = await api<{ url: string; mimeType: string }>(`/projects/${projectId}/drive/files/${file.id}/preview`, token); setPreview({ name: file.name, url: result.url, mimeType: result.mimeType }); } } catch (reason) { setError(reason instanceof Error ? reason.message : "미리보기를 열지 못했습니다."); } };
  const openDetails = async (file: DriveFile) => { setSelectedIssueId(""); try { if (mode === "api") { const [versions, feed] = await Promise.all([api<Version[]>(`/projects/${projectId}/drive/files/${file.id}/versions`, token), api<{ items: Issue[] }>(`/projects/${projectId}/groups/${groupId}/feed?pageSize=50`, token)]); setVersionFile({ ...file, versions }); setIssues(feed.items); } else { setVersionFile(localStore().files.find((item) => item.id === file.id) ?? file); setIssues([{ id: "local-seed-1", title: "분양가·사업비 변동 수익성 민감도 검토" }]); } } catch (reason) { setError(reason instanceof Error ? reason.message : "파일 상세를 열지 못했습니다."); } };
  const linkIssue = async () => { if (!versionFile || !selectedIssueId) return; try { if (mode === "local") { const store = localStore(); const file = store.files.find((item) => item.id === versionFile.id); const issue = issues.find((item) => item.id === selectedIssueId); if (file && issue && !file.issueLinks?.some((link) => link.post.id === issue.id)) (file.issueLinks ??= []).push({ id: uid(), post: { ...issue, groupId } }); saveLocal(store); setVersionFile(file ?? versionFile); } else { const link = await api<IssueLink>(`/projects/${projectId}/drive/files/${versionFile.id}/issues`, token, { method: "POST", body: JSON.stringify({ postId: selectedIssueId }) }); setVersionFile((current) => current ? { ...current, issueLinks: [...(current.issueLinks ?? []).filter((item) => item.post.id !== link.post.id), link] } : current); } setSelectedIssueId(""); setNotice("이슈와 파일을 연결했습니다."); await refresh(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "이슈를 연결하지 못했습니다."); } };
  const unlinkIssue = async (postId: string) => { if (!versionFile) return; try { if (mode === "local") { const store = localStore(); const file = store.files.find((item) => item.id === versionFile.id); if (file) file.issueLinks = file.issueLinks?.filter((link) => link.post.id !== postId); saveLocal(store); setVersionFile(file ?? versionFile); } else { await api(`/projects/${projectId}/drive/files/${versionFile.id}/issues/${postId}`, token, { method: "DELETE" }); setVersionFile((current) => current ? { ...current, issueLinks: current.issueLinks?.filter((link) => link.post.id !== postId) } : current); } await refresh(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "이슈 연결을 해제하지 못했습니다."); } };
  const used = useMemo(() => [...files].reduce((sum, file) => sum + Number(file.versions[0]?.size ?? 0), 0), [files]);

  return <section className="database-drive">
    <header className="drive-title"><div><span className="sample-label"><i /> 프로젝트 파일함</span><h2>공유 드라이브</h2><p>도면과 문서를 폴더별로 공유하고 변경 이력을 관리합니다.</p></div><div className="drive-title-actions"><button type="button" disabled={mode === "loading"} onClick={() => setFolderForm((open) => !open)}>＋ 새 폴더</button><label className="primary-button file-upload-button">+ 파일 업로드<input aria-label="+ 파일 업로드" type="file" accept={allowed} disabled={busy || mode === "loading"} onChange={(event) => void upload(event.target.files?.[0])} /></label></div></header>
    {mode === "local" && <div className="drive-mode">로컬 저장 모드 · API 실행 시 PostgreSQL 및 S3 저장소로 자동 연결됩니다.</div>}{error && <div className="db-feed-error" role="alert">{error}</div>}{notice && <div className="drive-notice">{notice}<button type="button" onClick={() => setNotice("")}>닫기</button></div>}
    {folderForm && <form className="drive-folder-form" onSubmit={createFolder}><input aria-label="새 폴더 이름" value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="폴더 이름" maxLength={120} required /><select aria-label="폴더 접근 그룹" value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}><option value="">프로젝트 전체 공개</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}만 접근</option>)}</select><label><input type="checkbox" checked={restricted} onChange={(event) => setRestricted(event.target.checked)} /> 관리자 전용</label><button type="submit" disabled={busy}>만들기</button><button type="button" onClick={() => setFolderForm(false)}>취소</button></form>}
    <div className={`drive-layout ${dragging ? "is-dragging" : ""}`} onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={(event) => void handleDrop(event, currentId)}>
      <aside className="folder-tree"><strong>프로젝트 파일</strong><button type="button" className={currentId === null ? "active" : ""} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void handleDrop(event, null)} onClick={() => void goPath(-1)}>🏠 전체 파일</button>{rootFolders.map((folder) => <button type="button" className={path[0]?.id === folder.id ? "active" : ""} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void handleDrop(event, folder.id)} onClick={() => { setPath([]); void openFolder(folder); }} key={folder.id}>{folder.isRestricted || folder.groupAccess?.length ? "🔒" : "📁"} {folder.name}</button>)}<div className="drive-usage"><span>현재 목록 용량</span><div><i style={{ width: `${Math.min(100, used / 1048576)}%` }} /></div><small>{sizeText(String(used))} / 100 GB</small></div></aside>
      <div className="drive-content"><div className="breadcrumb"><button type="button" onDragOver={(event) => event.preventDefault()} onDrop={(event) => void handleDrop(event, null)} onClick={() => void goPath(-1)}>용산 리버파크</button>{path.map((folder, index) => <span key={folder.id}><b>/</b><button type="button" onClick={() => void goPath(index)}>{folder.name}</button></span>)}<input aria-label="파일 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="전체 파일 검색" /></div><div className="data-head file-columns"><span>이름</span><span>소유자</span><span>수정일</span><span>크기 / 작업</span></div>
        {folders.map((folder) => <div className="data-row file-columns drive-row" draggable onDragStart={(event) => event.dataTransfer.setData("application/x-project-hub-drive", JSON.stringify({ kind: "folder", id: folder.id }))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void handleDrop(event, folder.id)} key={folder.id}><span><i className="file-type folder">▰</i><button className="drive-name" type="button" onClick={() => void openFolder(folder)}><strong>{folder.name}</strong>{folder.isRestricted && <small>관리자 전용</small>}{folder.groupAccess?.length ? <small>{folder.groupAccess.map((access) => access.group?.name ?? "협업 그룹").join(", ")} 전용</small> : null}</button></span><span>{folder.createdBy?.name ?? "김지훈"}</span><span>{dateText(folder.updatedAt)}</span><span>—<span className="drive-actions"><button type="button" onClick={() => void rename("folder", folder)}>이름 변경</button><button type="button" onClick={() => void remove("folder", folder)}>삭제</button></span></span></div>)}
        {files.map((file) => <div className="data-row file-columns drive-row" draggable onDragStart={(event) => event.dataTransfer.setData("application/x-project-hub-drive", JSON.stringify({ kind: "file", id: file.id }))} key={file.id}><span><i className={`file-type ${fileType(file.name).toLowerCase()}`}>{fileType(file.name)}</i><button className="drive-name" type="button" onClick={() => void openDetails(file)}><strong>{file.name}</strong><small>버전 {file.versions[0]?.version ?? 0}{file.issueLinks?.length ? ` · 이슈 ${file.issueLinks.length}건 연결` : ""}</small></button></span><span>{file.createdBy?.name ?? "김지훈"}</span><span>{dateText(file.updatedAt)}</span><span>{sizeText(file.versions[0]?.size ?? "0")}<span className="drive-actions">{(file.versions[0]?.mimeType === "application/pdf" || file.versions[0]?.mimeType?.startsWith("image/")) && <button type="button" onClick={() => void previewFile(file)}>미리보기</button>}<button type="button" onClick={() => void download(file)}>다운로드</button><button type="button" onClick={() => void openDetails(file)}>버전·이슈</button><button type="button" onClick={() => void rename("file", file)}>이름 변경</button><button type="button" onClick={() => void remove("file", file)}>삭제</button></span></span></div>)}
        {folders.length === 0 && files.length === 0 && <div className="workspace-empty"><strong>표시할 파일이 없습니다.</strong><span>파일을 이 영역으로 끌어 놓거나 업로드 버튼을 사용하세요.</span></div>} {dragging && <div className="drive-drop-overlay">이 폴더에 파일 놓기</div>}
      </div>
    </div>
    {uploadTasks.length > 0 && <aside className="drive-upload-queue"><div><strong>업로드 {uploadTasks.filter((task) => task.status === "uploading").length}건 진행 중</strong><button type="button" onClick={() => setUploadTasks((current) => current.filter((task) => task.status === "uploading"))}>완료 항목 닫기</button></div>{uploadTasks.map((task) => <div className={`upload-task ${task.status}`} key={task.id}><span>{task.name}</span><b>{task.status === "failed" ? "실패" : `${task.progress}%`}</b><i><em style={{ width: `${task.progress}%` }} /></i>{task.message && <small>{task.message}</small>}{task.status === "failed" && <button type="button" onClick={() => { setUploadTasks((current) => current.filter((item) => item.id !== task.id)); void upload(task.file, task.target, task.destinationId); }}>다시 시도</button>}</div>)}</aside>}
    {versionFile && <div className="drive-version-panel"><div><h3>{versionFile.name}</h3><button type="button" onClick={() => setVersionFile(null)}>닫기</button></div><div className="drive-detail-actions"><button type="button" onClick={() => void previewFile(versionFile)}>미리보기</button><label className="primary-button file-upload-button">새 버전 업로드<input aria-label="새 버전 업로드" type="file" accept={allowed} onChange={(event) => void upload(event.target.files?.[0], versionFile)} /></label></div><h4>연결된 이슈</h4><div className="drive-issue-linker"><select aria-label="연결할 이슈" value={selectedIssueId} onChange={(event) => setSelectedIssueId(event.target.value)}><option value="">이슈 선택</option>{issues.map((issue) => <option value={issue.id} key={issue.id}>{issue.title}</option>)}</select><button type="button" onClick={() => void linkIssue()}>연결</button></div>{versionFile.issueLinks?.map((link) => <p className="linked-issue" key={link.id}><span>🔗 {link.post.title}</span><button type="button" onClick={() => void unlinkIssue(link.post.id)}>연결 해제</button></p>)}<h4>버전 이력</h4>{versionFile.versions.map((version) => <p key={version.id}><strong>v{version.version}</strong><span>{version.originalName}</span><small>{version.uploadedBy?.name ?? "김지훈"} · {dateText(version.createdAt)} · {sizeText(version.size)}</small></p>)}</div>}
    {preview && <div className="drive-preview" role="dialog" aria-label={`${preview.name} 미리보기`}><div><strong>{preview.name}</strong><button type="button" onClick={() => setPreview(null)}>닫기</button></div>{preview.mimeType === "application/pdf" ? <iframe title={`${preview.name} PDF 미리보기`} src={preview.url} /> : <div className="drive-preview-image"><Image src={preview.url} alt={`${preview.name} 미리보기`} fill unoptimized sizes="92vw" /></div>}</div>}
  </section>;
}
