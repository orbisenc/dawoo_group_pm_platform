"use client";
/* eslint-disable @next/next/no-img-element -- 사용자 선택 data URL은 Next Image 최적화 대상이 아니다. */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";

import { useOptionalAuth } from "../auth/auth-context";
import { notifyNavigationBadgeChange } from "../../lib/navigation-badges";
import { useProject } from "./project-context";

type Comment = { id: string; author: string; authorId: string; body: string; createdAt: string };
type PostState = "의사결정" | "검토 중" | "검토 완료";
type InlineMedia = { id: string; name: string; kind: "image" | "video"; mimeType: string; dataUrl: string; size: number };
type EditorBlock = { id: string; type: "text"; text: string } | { id: string; type: "media"; media: InlineMedia };
type Post = {
  id: string; projectId: string; state: PostState; category: string; title: string; body: string;
  author: string; authorId: string; role: string; createdAt: string; updatedAt: string;
  deletedAt: string | null; purgeAt: string | null; media: InlineMedia[]; contentBlocks?: EditorBlock[]; likes: number; comments: Comment[];
};
type FeedStore = { version: 1; projects: Record<string, Post[]> };
type WritableDataFile = {
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
};
type FilePickerWindow = Window & {
  showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<WritableDataFile>;
};

const storageKey = "project-hub-issue-feed-v2";
const retentionDays = 30;
const emptyStore: FeedStore = { version: 1, projects: {} };
const categories = ["사업성", "금융", "인허가", "설계", "시공", "운영"];

function stateClass(state: PostState) {
  if (state === "의사결정") return "red";
  if (state === "검토 완료") return "green";
  return "orange";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

function purgeExpired(store: FeedStore): FeedStore {
  const now = Date.now();
  const projects = Object.fromEntries(Object.entries(store.projects ?? {}).map(([projectId, posts]) => [
    projectId,
    posts.filter((post) => !post.purgeAt || new Date(post.purgeAt).getTime() > now),
  ]));
  return { version: 1, projects };
}

function openFeedDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open("project-hub-content", 1);
    request.onerror = () => reject(request.error ?? new Error("게시물 데이터베이스를 열지 못했습니다."));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("stores")) request.result.createObjectStore("stores");
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function readStore(): Promise<FeedStore> {
  try {
    if (window.indexedDB) {
      const database = await openFeedDatabase();
      const result = await new Promise<FeedStore | undefined>((resolve, reject) => {
        const request = database.transaction("stores", "readonly").objectStore("stores").get(storageKey);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result as FeedStore | undefined);
      });
      database.close();
      if (result) return purgeExpired(result);
    }
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return emptyStore;
    return purgeExpired(JSON.parse(raw) as FeedStore);
  } catch {
    return emptyStore;
  }
}

async function writeStore(store: FeedStore) {
  if (window.indexedDB) {
    const database = await openFeedDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("stores", "readwrite");
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
      transaction.objectStore("stores").put(store, storageKey);
    });
    database.close();
    return;
  }
  window.localStorage?.setItem(storageKey, JSON.stringify(store));
}

async function writeDataFile(handle: WritableDataFile, store: FeedStore) {
  const writable = await handle.createWritable();
  await writable.write(new Blob([JSON.stringify(store, null, 2)], { type: "application/json" }));
  await writable.close();
}

function fileToMedia(file: File) {
  return new Promise<InlineMedia>((resolve, reject) => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) return reject(new Error("본문에는 이미지 또는 영상 파일만 추가할 수 있습니다."));
    const limit = isImage ? 3 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > limit) return reject(new Error(isImage ? "이미지는 파일당 3MB 이하만 가능합니다." : "영상은 파일당 10MB 이하만 가능합니다."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("미디어 파일을 읽지 못했습니다."));
    reader.onload = () => resolve({
      id: crypto.randomUUID(), name: file.name, kind: isImage ? "image" : "video",
      mimeType: file.type, dataUrl: String(reader.result), size: file.size,
    });
    reader.readAsDataURL(file);
  });
}

export function IssueFeed({ title = "이슈 피드", fullPage = false, adminMode }: { title?: string; fullPage?: boolean; adminMode?: boolean }) {
  const { selectedProject } = useProject();
  const auth = useOptionalAuth();
  const isAdmin = adminMode ?? auth?.isAdmin ?? false;
  const actorName = auth?.user?.name ?? "로컬 사용자";
  const actorId = auth?.user?.id ?? "local-user";
  const [store, setStore] = useState<FeedStore>(emptyStore);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<"feed" | "trash">("feed");
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"전체" | "검토 중" | "의사결정" | "완료">("전체");
  const [composerOpen, setComposerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("사업성");
  const [draftBlocks, setDraftBlocks] = useState<EditorBlock[]>([{ id: "draft-start", type: "text", text: "" }]);
  const [activeTextBlockId, setActiveTextBlockId] = useState("draft-start");
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editState, setEditState] = useState<PostState>("검토 중");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dataFileHandle, setDataFileHandle] = useState<WritableDataFile | null>(null);

  useEffect(() => {
    let active = true;
    void readStore().then((saved) => {
      if (!active) return;
      setStore(saved);
      setLoaded(true);
      void writeStore(saved);
    });
    return () => { active = false; };
  }, []);

  const posts = useMemo(() => store.projects[selectedProject.id] ?? [], [selectedProject.id, store.projects]);
  const activePosts = useMemo(() => posts.filter((post) => !post.deletedAt), [posts]);
  const deletedPosts = useMemo(() => posts.filter((post) => Boolean(post.deletedAt)), [posts]);
  const draftMediaCount = useMemo(() => draftBlocks.filter((block) => block.type === "media").length, [draftBlocks]);

  const updatePosts = useCallback((updater: (current: Post[]) => Post[]) => {
    setStore((current) => {
      const next: FeedStore = { version: 1, projects: { ...current.projects, [selectedProject.id]: updater(current.projects[selectedProject.id] ?? []) } };
      void writeStore(next).then(() => {
        setError("");
        notifyNavigationBadgeChange("issues");
      }).catch(() => {
        setError("브라우저 저장 공간이 부족합니다. 큰 영상을 제거하거나 데이터 파일을 내보낸 뒤 오래된 게시물을 정리해 주세요.");
      });
      if (dataFileHandle) {
        void writeDataFile(dataFileHandle, next).catch(() => setError("연결된 Git 데이터 파일에 변경사항을 저장하지 못했습니다."));
      }
      return next;
    });
  }, [dataFileHandle, selectedProject.id]);

  const visiblePosts = useMemo(() => activePosts.filter((post) => {
    const matchesQuery = `${post.title} ${post.body} ${post.id} ${post.author}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "전체" || post.state === filter || (filter === "완료" && post.state === "검토 완료");
    return matchesQuery && matchesFilter;
  }), [activePosts, filter, query]);

  async function addMediaFiles(files: File[], blockId: string, offset?: number) {
    if (!files.length) return;
    const mediaCount = draftBlocks.filter((block) => block.type === "media").length;
    if (mediaCount + files.length > 6) return setError("본문 미디어는 게시물당 최대 6개까지 추가할 수 있습니다.");
    try {
      const media = await Promise.all(files.map(fileToMedia));
      const nextTextId = crypto.randomUUID();
      setDraftBlocks((current) => current.flatMap((block) => {
        if (block.id !== blockId || block.type !== "text") return [block];
        const splitAt = Math.max(0, Math.min(offset ?? block.text.length, block.text.length));
        return [
          { ...block, text: block.text.slice(0, splitAt) },
          ...media.map((item) => ({ id: item.id, type: "media" as const, media: item })),
          { id: nextTextId, type: "text" as const, text: block.text.slice(splitAt) },
        ];
      }));
      setActiveTextBlockId(nextTextId);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "미디어를 추가하지 못했습니다.");
    }
  }

  async function selectMedia(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    const activeBlock = draftBlocks.find((block) => block.id === activeTextBlockId && block.type === "text");
    await addMediaFiles(files, activeTextBlockId, activeBlock?.type === "text" ? activeBlock.text.length : undefined);
  }

  function dropMedia(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingMedia(false);
    const target = event.target instanceof HTMLTextAreaElement ? event.target : null;
    const blockId = target?.dataset.blockId ?? activeTextBlockId;
    void addMediaFiles([...event.dataTransfer.files], blockId, target?.selectionStart);
  }

  function removeMediaBlock(blockId: string) {
    setDraftBlocks((current) => current.filter((block) => block.id !== blockId));
  }

  function addPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draftBlocks.filter((block): block is Extract<EditorBlock, { type: "text" }> => block.type === "text").map((block) => block.text.trim()).filter(Boolean).join("\n\n");
    if (!newTitle.trim() || !body) return;
    const media = draftBlocks.filter((block): block is Extract<EditorBlock, { type: "media" }> => block.type === "media").map((block) => block.media);
    const now = new Date().toISOString();
    const post: Post = {
      id: crypto.randomUUID(), projectId: selectedProject.id, state: "검토 중", category: newCategory,
      title: newTitle.trim(), body, author: actorName, authorId: actorId,
      role: isAdmin ? "시스템 관리자" : "승인 사용자", createdAt: now, updatedAt: now,
      deletedAt: null, purgeAt: null, media, contentBlocks: draftBlocks, likes: 0, comments: [],
    };
    updatePosts((current) => [post, ...current]);
    const firstBlockId = crypto.randomUUID();
    setNewTitle(""); setDraftBlocks([{ id: firstBlockId, type: "text", text: "" }]); setActiveTextBlockId(firstBlockId); setComposerOpen(false); setFilter("전체");
    setNotice("게시물을 등록했습니다.");
  }

  function addComment(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    const body = drafts[postId]?.trim();
    if (!body) return;
    updatePosts((current) => current.map((post) => post.id === postId ? {
      ...post, comments: [...post.comments, { id: crypto.randomUUID(), author: actorName, authorId: actorId, body, createdAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    } : post));
    setDrafts((current) => ({ ...current, [postId]: "" }));
    setOpenComments(postId);
  }

  function startEdit(post: Post) {
    setEditingPostId(post.id); setEditTitle(post.title); setEditBody(post.body); setEditCategory(post.category); setEditState(post.state); setMenuPostId(null);
  }

  function saveEditedPost(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    if (!editTitle.trim() || !editBody.trim()) return;
    updatePosts((current) => current.map((post) => post.id === postId ? {
      ...post, title: editTitle.trim(), body: editBody.trim(), contentBlocks: undefined, category: editCategory, state: editState, updatedAt: new Date().toISOString(),
    } : post));
    setEditingPostId(null); setNotice("게시물을 수정했습니다.");
  }

  function moveToTrash(post: Post) {
    if (!window.confirm(`‘${post.title}’ 게시물을 휴지통으로 이동할까요?`)) return;
    const deletedAt = new Date();
    const purgeAt = new Date(deletedAt);
    purgeAt.setDate(purgeAt.getDate() + retentionDays);
    updatePosts((current) => current.map((item) => item.id === post.id ? {
      ...item, deletedAt: deletedAt.toISOString(), purgeAt: purgeAt.toISOString(), updatedAt: deletedAt.toISOString(),
    } : item));
    setMenuPostId(null); setEditingPostId(null);
    setNotice("게시물을 휴지통으로 이동했습니다. 30일 동안 복구할 수 있습니다.");
  }

  function restore(postId: string) {
    updatePosts((current) => current.map((post) => post.id === postId ? { ...post, deletedAt: null, purgeAt: null, updatedAt: new Date().toISOString() } : post));
    setNotice("게시물을 복구했습니다.");
  }

  function purge(post: Post) {
    if (!window.confirm(`‘${post.title}’ 게시물을 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    updatePosts((current) => current.filter((item) => item.id !== post.id));
    setNotice("게시물을 영구 삭제했습니다.");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "issue-feed.json"; link.click(); URL.revokeObjectURL(url);
    setNotice("Git 저장소용 데이터 파일을 내려받았습니다.");
  }

  async function connectDataFile() {
    const picker = (window as FilePickerWindow).showSaveFilePicker;
    if (!picker) {
      exportData();
      return;
    }
    try {
      const handle = await picker.call(window, {
        suggestedName: "issue-feed.json",
        types: [{ description: "PROJECT HUB 이슈 데이터", accept: { "application/json": [".json"] } }],
      });
      await writeDataFile(handle, store);
      setDataFileHandle(handle);
      setNotice("Git 데이터 파일을 연결했습니다. 이 세션의 이후 변경사항이 같은 파일에 동기화됩니다.");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError("Git 데이터 파일을 연결하지 못했습니다.");
    }
  }

  if (!loaded) return <section className="issue-feed"><div className="feed-empty"><strong>이슈 피드를 불러오고 있습니다.</strong></div></section>;

  return (
    <section className={fullPage ? "issue-feed full-page" : "issue-feed"}>
      <div className="feed-heading">
        <div><h2>{title}</h2><span className="feed-project-name">{selectedProject.name}</span></div>
        <div>
          {view === "feed" ? <label><span aria-hidden="true">⌕</span><input aria-label="이슈 검색" placeholder="이슈 검색..." value={query} onChange={(event) => setQuery(event.target.value)} /></label> : null}
          {isAdmin ? <button className={view === "trash" ? "active" : ""} type="button" onClick={() => setView((current) => current === "trash" ? "feed" : "trash")}>{view === "trash" ? "피드로 돌아가기" : `휴지통 ${deletedPosts.length ? `(${deletedPosts.length})` : ""}`}</button> : null}
          {view === "feed" ? <button type="button" onClick={() => setComposerOpen((open) => !open)}>+ 새 이슈 등록</button> : null}
        </div>
      </div>

      {view === "feed" ? <div className="feed-tabs">{(["전체", "검토 중", "의사결정", "완료"] as const).map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} type="button" key={item}>{item}</button>)}</div> : <div className="feed-tabs trash-tabs"><strong>관리자 휴지통</strong><span>삭제된 게시물은 30일 뒤 자동 제거됩니다.</span><button type="button" onClick={() => void connectDataFile()}>{dataFileHandle ? "Git 데이터 파일 연결됨" : "Git 데이터 파일 연결"}</button></div>}
      {notice ? <div className="issue-edit-notice" role="status">{notice}<button type="button" aria-label="안내 닫기" onClick={() => setNotice("")}>×</button></div> : null}
      {error ? <div className="auth-error" role="alert">{error}</div> : null}

      <div className="feed-scroll">
        {view === "feed" && composerOpen ? (
          <form className="issue-composer" onSubmit={addPost}>
            <div><strong>새 이슈 등록</strong><button type="button" onClick={() => setComposerOpen(false)} aria-label="닫기">×</button></div>
            <input aria-label="새 이슈 제목" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="이슈 제목을 입력하세요" maxLength={120} required />
            <div
              className={`inline-media-dropzone${isDraggingMedia ? " is-dragging" : ""}`}
              onDragEnter={(event) => { event.preventDefault(); setIsDraggingMedia(true); }}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setIsDraggingMedia(true); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingMedia(false); }}
              onDrop={dropMedia}
              aria-label="이슈 본문 이미지 및 영상 드롭 영역"
            >
              {draftBlocks.map((block, index) => block.type === "text" ? (
                <textarea
                  key={block.id}
                  data-block-id={block.id}
                  aria-label={index === 0 ? "새 이슈 내용" : `본문 이어쓰기 ${index}`}
                  value={block.text}
                  onFocus={() => setActiveTextBlockId(block.id)}
                  onChange={(event) => setDraftBlocks((current) => current.map((item) => item.id === block.id && item.type === "text" ? { ...item, text: event.target.value } : item))}
                  placeholder={index === 0 ? "현황과 의사결정 요청사항을 입력하세요" : "이미지 아래에 내용을 이어서 입력하세요"}
                  maxLength={5000}
                />
              ) : (
                <figure className="editor-media-block" key={block.id}>
                  {block.media.kind === "image" ? <img src={block.media.dataUrl} alt={block.media.name} /> : <video src={block.media.dataUrl} controls preload="metadata" aria-label={block.media.name} />}
                  <figcaption>{block.media.name}</figcaption>
                  <button type="button" aria-label={`${block.media.name} 제거`} onClick={() => removeMediaBlock(block.id)}>×</button>
                </figure>
              ))}
              <p className="inline-media-drop-hint">작성 중 원하는 위치에 이미지나 영상을 끌어다 놓으세요.</p>
            </div>
            <div className="composer-options">
              <select aria-label="이슈 분류" value={newCategory} onChange={(event) => setNewCategory(event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select>
              <label className="attach-button">본문 이미지·영상<input aria-label="본문 이미지 또는 영상" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple onChange={(event) => void selectMedia(event)} /></label>
              <span>{draftMediaCount ? `${draftMediaCount}개 추가됨` : "이미지 3MB · 영상 10MB 이하"}</span><button type="submit">이슈 등록</button>
            </div>
          </form>
        ) : null}

        {view === "trash" ? deletedPosts.map((post) => (
          <article className="issue-post trash-post" key={post.id}>
            <div className="post-meta"><div><b className="post-state red">삭제됨</b><em>{post.category}</em></div><time>삭제일 {formatDate(post.deletedAt!)}</time></div>
            <h3>{post.title}</h3><p>{post.body}</p>
            <div className="trash-post-footer"><span>자동 삭제 예정: {formatDate(post.purgeAt!)}</span><div><button type="button" onClick={() => restore(post.id)}>복구</button><button className="danger" type="button" onClick={() => purge(post)}>영구 삭제</button></div></div>
          </article>
        )) : visiblePosts.map((post) => {
          const canManage = isAdmin || post.authorId === actorId;
          return (
            <article className="issue-post" key={post.id}>
              <div className="post-meta">
                <div><b className={`post-state ${stateClass(post.state)}`}>{post.state}</b><span>{post.id.slice(0, 8)}</span><em>{post.category}</em></div><time>{formatDate(post.updatedAt)}</time>
                {canManage ? <div className="post-menu"><button type="button" aria-label={`${post.title} 게시물 메뉴`} aria-haspopup="menu" aria-expanded={menuPostId === post.id} onClick={() => setMenuPostId((current) => current === post.id ? null : post.id)}>⋮</button>{menuPostId === post.id ? <div className="post-menu-popover" role="menu"><button type="button" role="menuitem" onClick={() => startEdit(post)}>✎ 게시물 수정</button><button className="danger" type="button" role="menuitem" onClick={() => moveToTrash(post)}>⌫ 게시물 삭제</button></div> : null}</div> : null}
              </div>
              {editingPostId === post.id ? <form className="issue-edit-form" onSubmit={(event) => saveEditedPost(event, post.id)}><div><strong>게시물 수정</strong><span>제목과 내용을 수정해 주세요.</span></div><input aria-label={`${post.id} 게시물 제목 수정`} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={120} required /><textarea aria-label={`${post.id} 게시물 내용 수정`} value={editBody} onChange={(event) => setEditBody(event.target.value)} maxLength={5000} required /><div className="issue-edit-options"><label><span>분류</span><select aria-label={`${post.id} 게시물 분류 수정`} value={editCategory} onChange={(event) => setEditCategory(event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label><span>진행 상태</span><select aria-label={`${post.id} 게시물 상태 수정`} value={editState} onChange={(event) => setEditState(event.target.value as PostState)}><option>검토 중</option><option>의사결정</option><option>검토 완료</option></select></label><div><button type="button" onClick={() => setEditingPostId(null)}>취소</button><button type="submit">수정 저장</button></div></div></form> : <><h3>{post.title}</h3>{post.contentBlocks?.length ? <div className="issue-post-content">{post.contentBlocks.map((block) => block.type === "text" ? (block.text ? <p key={block.id}>{block.text}</p> : null) : block.media.kind === "image" ? <img key={block.id} src={block.media.dataUrl} alt={block.media.name} /> : <video key={block.id} src={block.media.dataUrl} controls preload="metadata" aria-label={block.media.name} />)}</div> : <><p className="issue-post-body">{post.body}</p>{post.media?.length ? <div className="inline-post-media">{post.media.map((media) => media.kind === "image" ? <img key={media.id} src={media.dataUrl} alt={media.name} /> : <video key={media.id} src={media.dataUrl} controls preload="metadata" aria-label={media.name} />)}</div> : null}</>}</>}
              <div className="post-author"><span className="mini-avatar">{post.author[0]}</span><strong>{post.author}</strong><small>{post.role}</small></div>
              <div className="post-actions"><button type="button" onClick={() => setOpenComments(openComments === post.id ? null : post.id)}>◯ <span>댓글</span> {post.comments.length}</button><button type="button" onClick={() => updatePosts((current) => current.map((item) => item.id === post.id ? { ...item, likes: item.likes + 1 } : item))}>♡ <span>공감</span> {post.likes}</button></div>
              {openComments === post.id ? <div className="comments-area">{post.comments.map((comment) => <div className="comment" key={comment.id}><span className="mini-avatar">{comment.author[0]}</span><div><strong>{comment.author}</strong><time>{formatDate(comment.createdAt)}</time><p>{comment.body}</p></div></div>)}{post.comments.length === 0 ? <p className="empty-comment">첫 댓글을 남겨보세요.</p> : null}<form onSubmit={(event) => addComment(event, post.id)}><span className="mini-avatar">{actorName[0]}</span><input aria-label={`${post.title} 댓글 입력`} value={drafts[post.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="댓글을 입력하세요..." /><button type="submit">등록</button></form></div> : null}
            </article>
          );
        })}
        {(view === "trash" ? deletedPosts.length === 0 : visiblePosts.length === 0) ? <div className="feed-empty"><strong>{view === "trash" ? "휴지통이 비어 있습니다." : "등록된 이슈가 없습니다."}</strong><span>{view === "trash" ? "삭제된 게시물은 이곳에서 30일 동안 보관됩니다." : "새 이슈 등록 버튼으로 첫 게시물을 작성해 주세요."}</span></div> : null}
      </div>
    </section>
  );
}
