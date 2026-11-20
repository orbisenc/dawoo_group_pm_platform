"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { io } from "socket.io-client";
import { useOptionalAuth } from "../auth/auth-context";

const typeLabels = {
  NOTICE: "공지사항",
  GENERAL: "일반 게시글",
  QUESTION: "질문",
  ISSUE: "이슈",
  DECISION: "의사결정",
} as const;
const statusLabels = {
  REGISTERED: "등록",
  UNDER_REVIEW: "검토 중",
  IN_PROGRESS: "진행 중",
  ON_HOLD: "보류",
  COMPLETED: "완료",
} as const;
const priorityLabels = {
  LOW: "낮음",
  NORMAL: "보통",
  HIGH: "높음",
  CRITICAL: "긴급",
} as const;

type PostType = keyof typeof typeLabels;
type Status = keyof typeof statusLabels;
type Priority = keyof typeof priorityLabels;
type Comment = {
  id: string;
  content: string;
  author: { name: string };
  replies: Comment[];
};
type Attachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: string;
  dataUrl?: string;
};
type FeedPost = {
  id: string;
  type: PostType;
  title: string;
  content: string;
  priority: Priority;
  status: Status;
  tags: string[];
  author: { name: string };
  assignee?: { id?: string; name: string } | null;
  attachments?: Attachment[];
  comments?: Comment[];
  _count?: { comments: number };
};
type Assignee = {
  user: { id: string; name: string };
  organization: { name: string };
  role: string;
};
type Mode = "loading" | "api" | "local";
type RealtimeEvent = {
  eventId: string;
  postId: string | null;
  type: string;
  occurredAt: string;
};
type NotificationItem = {
  id: string;
  type: string;
  message: string;
  projectId: string;
  groupId: string;
  postId: string | null;
  createdAt: string;
};

const localAssignees: Assignee[] = [
  {
    user: { id: "local-kim", name: "김지훈" },
    organization: { name: "한강디벨롭먼트" },
    role: "CLIENT_ADMIN",
  },
  {
    user: { id: "local-park", name: "박민수" },
    organization: { name: "한빛건설" },
    role: "EXTERNAL_PARTNER",
  },
];

const designGroupId = "40000000-0000-4000-8000-000000000001";
const constructionGroupId = "40000000-0000-4000-8000-000000000002";
const planningGroupId = "40000000-0000-4000-8000-000000000003";
const noticeGroupId = "40000000-0000-4000-8000-000000000004";

function samplePost(
  id: string,
  values: Partial<FeedPost> & Pick<FeedPost, "type" | "title" | "content">,
): FeedPost {
  const comments = values.comments ?? [];
  return {
    id,
    priority: "NORMAL",
    status: "REGISTERED",
    tags: [],
    author: { name: "김지훈" },
    assignee: null,
    attachments: [],
    ...values,
    comments,
    _count: {
      comments: comments.reduce(
        (count, item) => count + 1 + item.replies.length,
        0,
      ),
    },
  };
}

function initialLocalPosts(groupId: string): FeedPost[] {
  if (process.env.NEXT_PUBLIC_ENABLE_FEED_SAMPLES !== "true") return [];
  const reply = (id: string, content: string, author: string): Comment => ({
    id,
    content,
    author: { name: author },
    replies: [],
  });
  const posts: Record<string, FeedPost[]> = {
    [designGroupId]: [
      samplePost("design-issue-1", {
        type: "DECISION",
        title: "분양가·사업비 변동에 따른 수익성 민감도 검토",
        content:
          "기준 분양가와 총사업비 변동 시 목표 사업수익률이 유지되는지 검토가 필요합니다.",
        priority: "HIGH",
        status: "UNDER_REVIEW",
        tags: ["사업수지", "민감도", "투자심의"],
        assignee: { id: "local-park", name: "박민수" },
        comments: [
          reply(
            "design-comment-1",
            "금융비용 상승 시나리오를 추가해 투자심의 자료로 정리하겠습니다.",
            "박민수",
          ),
        ],
      }),
      samplePost("design-question-1", {
        type: "QUESTION",
        title: "적정 분양가 및 상품 구성 가정 확인",
        content:
          "시장조사 결과를 반영한 평형별 적정 분양가와 상품 구성 가정을 최종 확인해 주세요.",
        priority: "NORMAL",
        status: "IN_PROGRESS",
        tags: ["분양가", "상품기획", "시장조사"],
        comments: [
          reply(
            "design-comment-2",
            "인근 경쟁사업지의 최근 계약률과 함께 비교하겠습니다.",
            "김지훈",
          ),
        ],
      }),
      samplePost("design-decision-1", {
        type: "DECISION",
        title: "주거·상업시설 개발비중 1차안 확정",
        content:
          "시설별 매출과 운영수익을 비교해 주거·상업시설 개발비중 1차안을 확정했습니다.",
        status: "COMPLETED",
        tags: ["개발계획", "시설비중", "결정사항"],
      }),
    ],
    [constructionGroupId]: [
      samplePost("construction-issue-1", {
        type: "DECISION",
        title: "토지비 조달 및 브릿지론 구조 비교안",
        content:
          "자기자본 투입 비율과 브릿지론 만기 조건별 자금조달안을 비교했습니다.",
        priority: "CRITICAL",
        status: "UNDER_REVIEW",
        tags: ["금융PF", "브릿지론", "자금조달"],
        assignee: { id: "local-park", name: "박민수" },
        comments: [
          reply(
            "construction-comment-1",
            "책임준공 조건과 중도상환수수료를 동일 기준으로 환산하겠습니다.",
            "박민수",
          ),
        ],
      }),
      samplePost("construction-general-1", {
        type: "GENERAL",
        title: "월간 자금수지 및 집행계획",
        content:
          "토지비, 금융비용, 용역비 집행실적과 다음 달 자금 소요계획을 공유합니다.",
        status: "IN_PROGRESS",
        tags: ["자금수지", "집행계획", "현금흐름"],
      }),
      samplePost("construction-issue-2", {
        type: "ISSUE",
        title: "공사비 상승분 반영 사업성 재검토",
        content:
          "최근 견적 상승분을 총사업비에 반영할 경우 목표 수익률 하락폭과 절감 대안을 검토해 주세요.",
        priority: "HIGH",
        status: "ON_HOLD",
        tags: ["사업비", "수익률", "원가절감"],
      }),
    ],
    [planningGroupId]: [
      samplePost("planning-decision-1", {
        type: "DECISION",
        title: "분양 일정 조정안 의사결정",
        content:
          "인허가 보완 일정을 반영하여 홍보관 개관과 분양 일정을 2주 순연하기로 결정했습니다.",
        priority: "HIGH",
        status: "COMPLETED",
        tags: ["분양", "사업일정", "의사결정"],
      }),
      samplePost("planning-question-1", {
        type: "QUESTION",
        title: "PF 약정 선행조건 자료 요청",
        content:
          "금융기관 검토를 위해 토지확보율, 인허가 현황, 공사비 검증자료 최신본을 요청드립니다.",
        status: "UNDER_REVIEW",
        tags: ["금융PF", "선행조건", "자료요청"],
        assignee: { id: "local-kim", name: "김지훈" },
      }),
      samplePost("planning-general-1", {
        type: "GENERAL",
        title: "사업수지 민감도 분석 공유",
        content:
          "공사비와 분양가 변동률에 따른 사업수지 민감도 분석 결과를 공유합니다.",
        priority: "NORMAL",
        status: "IN_PROGRESS",
        tags: ["사업수지", "공사비", "분양가"],
      }),
    ],
    [noticeGroupId]: [
      samplePost("notice-1", {
        type: "NOTICE",
        title: "프로젝트 정기회의 운영 안내",
        content:
          "매주 수요일 오후 2시에 주간 프로젝트 정기회의를 진행합니다. 안건은 하루 전까지 등록해 주세요.",
        priority: "HIGH",
        status: "REGISTERED",
        tags: ["공지", "정기회의"],
      }),
      samplePost("notice-2", {
        type: "NOTICE",
        title: "공유 드라이브 문서명 작성 기준",
        content:
          "문서명은 날짜_공종_문서명_버전 순서로 작성하고 승인본은 승인완료 폴더에 보관해 주세요.",
        status: "REGISTERED",
        tags: ["공지", "문서관리", "파일명"],
      }),
      samplePost("notice-3", {
        type: "NOTICE",
        title: "현장 안전교육 일정 안내",
        content:
          "신규 참여자 대상 현장 안전교육을 11월 2일 오전 9시에 진행합니다.",
        priority: "NORMAL",
        status: "REGISTERED",
        tags: ["공지", "안전교육", "일정"],
      }),
    ],
  };
  return posts[groupId] ?? posts[designGroupId]!;
}

function localKey(projectId: string, groupId: string) {
  return `project-hub:group-feed:v4:${projectId}:${groupId}`;
}

function readLocalPosts(projectId: string, groupId: string) {
  try {
    const saved = window.localStorage.getItem(localKey(projectId, groupId));
    if (saved) return JSON.parse(saved) as FeedPost[];
  } catch {
    /* 손상된 로컬 데이터는 빈 피드로 복구한다. */
  }
  const posts = initialLocalPosts(groupId);
  try {
    window.localStorage?.setItem(
      localKey(projectId, groupId),
      JSON.stringify(posts),
    );
  } catch {
    /* 저장소가 차단된 환경에서는 현재 세션의 초기 데이터만 사용한다. */
  }
  return posts;
}

function writeLocalPosts(
  projectId: string,
  groupId: string,
  posts: FeedPost[],
) {
  try {
    window.localStorage?.setItem(
      localKey(projectId, groupId),
      JSON.stringify(posts),
    );
  } catch {
    /* 저장소가 차단된 환경에서는 화면 상태만 유지한다. */
  }
}

function lastEventValue() {
  try {
    return window.localStorage?.getItem("project-hub:last-event-at") ?? "";
  } catch {
    return "";
  }
}

function fileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("첨부파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

async function api<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`/backend${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    throw new Error(
      Array.isArray(body?.message)
        ? body.message.join(" ")
        : (body?.message ?? "요청을 처리하지 못했습니다."),
    );
  }
  return response.json() as Promise<T>;
}

export function DatabaseIssueFeed({
  projectId = process.env.NEXT_PUBLIC_DEMO_PROJECT_ID ??
    "30000000-0000-4000-8000-000000000001",
  groupId = process.env.NEXT_PUBLIC_DEMO_GROUP_ID ??
    "40000000-0000-4000-8000-000000000001",
  groupName = "설계 관리",
}: {
  projectId?: string;
  groupId?: string;
  groupName?: string;
}) {
  const auth = useOptionalAuth();
  const canManagePosts = auth?.isAdmin ?? false;
  const [mode, setMode] = useState<Mode>("loading");
  const [token, setToken] = useState("");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<PostType | "">("");
  const [status, setStatus] = useState<Status | "">("");
  const [composer, setComposer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<PostType>("ISSUE");
  const [postStatus, setPostStatus] = useState<Status>("REGISTERED");
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [assigneeId, setAssigneeId] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [openedPost, setOpenedPost] = useState<FeedPost | null>(null);
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const processedEvents = useRef(new Set<string>());
  const lastEventAt = useRef(
    typeof window === "undefined" ? "" : lastEventValue(),
  );

  const filterLocal = useCallback(() => {
    const lowered = query.trim().toLowerCase();
    setPosts(
      readLocalPosts(projectId, groupId).filter(
        (post) =>
          (!type || post.type === type) &&
          (!status || post.status === status) &&
          (!lowered ||
            `${post.title} ${post.content} ${post.tags.join(" ")}`
              .toLowerCase()
              .includes(lowered)),
      ),
    );
  }, [groupId, projectId, query, status, type]);

  const loadApiPosts = useCallback(
    async (accessToken: string) => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      if (type) params.set("type", type);
      if (status) params.set("status", status);
      const result = await api<{ items: FeedPost[] }>(
        `/projects/${projectId}/groups/${groupId}/feed?${params}`,
        accessToken,
      );
      setPosts(result.items);
    },
    [groupId, projectId, query, status, type],
  );

  const openPost = useCallback(
    async (postId: string) => {
      if (mode === "local") {
        setOpenedPost(
          readLocalPosts(projectId, groupId).find(
            (post) => post.id === postId,
          ) ?? null,
        );
        return;
      }
      try {
        setOpenedPost(
          await api(
            `/projects/${projectId}/groups/${groupId}/feed/${postId}`,
            token,
          ),
        );
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "게시글을 열지 못했습니다.",
        );
      }
    },
    [groupId, mode, projectId, token],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        let accessToken = auth?.token ?? "";
        if (!accessToken) {
          const session = await fetch("/backend/auth/dev-session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: "partner@projecthub.local" }),
          });
          if (!session.ok) throw new Error("API unavailable");
          accessToken = ((await session.json()) as { accessToken: string }).accessToken;
        }
        const items = await api<Assignee[]>(
          `/projects/${projectId}/groups/${groupId}/feed/assignees`,
          accessToken,
        );
        if (!active) return;
        setToken(accessToken);
        setAssignees(items);
        setMode("api");
      } catch {
        if (!active) return;
        setAssignees(localAssignees);
        setMode("local");
      }
    })();
    return () => {
      active = false;
    };
  }, [auth?.token, groupId, projectId]);

  useEffect(() => {
    if (mode === "loading") return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      if (mode === "local") {
        if (active) {
          filterLocal();
          setLoading(false);
        }
        return;
      }
      void loadApiPosts(token)
        .catch((reason: unknown) => {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : "피드를 불러오지 못했습니다.",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 120);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filterLocal, loadApiPosts, mode, token]);

  useEffect(() => {
    if (mode !== "api" || !token) return;
    const socket = io(
      process.env.NEXT_PUBLIC_API_SOCKET_URL ?? "http://localhost:4000",
      { auth: { token }, transports: ["websocket"], reconnection: true },
    );
    const refreshUnread = () =>
      socket.emit(
        "notifications:unread",
        (result: { items?: NotificationItem[] }) =>
          setNotifications(result.items ?? []),
      );
    const handleEvent = (event: RealtimeEvent) => {
      if (processedEvents.current.has(event.eventId)) return;
      processedEvents.current.add(event.eventId);
      if (processedEvents.current.size > 1000)
        processedEvents.current.delete(
          processedEvents.current.values().next().value as string,
        );
      lastEventAt.current = event.occurredAt;
      try {
        window.localStorage?.setItem(
          "project-hub:last-event-at",
          event.occurredAt,
        );
      } catch {
        /* 브라우저 저장소가 차단되어도 현재 연결의 동기화는 유지한다. */
      }
      void loadApiPosts(token);
      if (openedPost?.id === event.postId) void openPost(event.postId);
    };
    const subscribeAndSync = () => {
      setConnected(true);
      socket.emit(
        "group:subscribe",
        { projectId, groupId },
        (result: { subscribed?: boolean }) => {
          if (!result?.subscribed) return;
          socket.emit(
            "group:sync",
            { projectId, groupId, since: lastEventAt.current || undefined },
            (sync: { events?: RealtimeEvent[] }) =>
              (sync.events ?? []).forEach(handleEvent),
          );
        },
      );
      refreshUnread();
    };
    socket.on("connect", subscribeAndSync);
    socket.on("disconnect", () => setConnected(false));
    socket.on("realtime:event", handleEvent);
    socket.on("notification:new", refreshUnread);
    return () => {
      socket.disconnect();
    };
  }, [groupId, loadApiPosts, mode, openPost, openedPost?.id, projectId, token]);

  const resetComposer = () => {
    setComposer(false);
    setEditingId(null);
    setTitle("");
    setContent("");
    setPostType("ISSUE");
    setPostStatus("REGISTERED");
    setPriority("NORMAL");
    setAssigneeId("");
    setTags("");
    setFile(null);
  };
  const startEdit = (post: FeedPost) => {
    setEditingId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setPostType(post.type);
    setPostStatus(post.status);
    setPriority(post.priority);
    setAssigneeId(post.assignee?.id ?? "");
    setTags(post.tags.join(", "));
    setComposer(true);
  };
  const selectedAssignee = () =>
    localAssignees.find((item) => item.user.id === assigneeId)?.user;

  const savePost = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const cleanTags = [
        ...new Set(
          tags
            .split(",")
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean),
        ),
      ];
      if (mode === "local") {
        const current = readLocalPosts(projectId, groupId);
        if (editingId) {
          writeLocalPosts(
            projectId,
            groupId,
            current.map((post) =>
              post.id === editingId
                ? {
                    ...post,
                    type: postType,
                    title: title.trim(),
                    content: content.trim(),
                    priority,
                    status: postStatus,
                    tags: cleanTags,
                    assignee: selectedAssignee() ?? null,
                  }
                : post,
            ),
          );
        } else {
          const attachment = file
            ? [
                {
                  id: crypto.randomUUID(),
                  originalName: file.name,
                  mimeType: file.type,
                  size: String(file.size),
                  dataUrl: await fileDataUrl(file),
                },
              ]
            : [];
          current.unshift({
            id: crypto.randomUUID(),
            type: postType,
            title: title.trim(),
            content: content.trim(),
            priority,
            status: postStatus,
            tags: cleanTags,
            author: { name: "김지훈" },
            assignee: selectedAssignee() ?? null,
            attachments: attachment,
            comments: [],
            _count: { comments: 0 },
          });
          writeLocalPosts(projectId, groupId, current);
        }
        resetComposer();
        filterLocal();
        return;
      }
      const body = {
        type: postType,
        title,
        content,
        priority,
        status: postStatus,
        assigneeId: assigneeId || undefined,
        tags: cleanTags,
      };
      const post = await api<FeedPost>(
        `/projects/${projectId}/groups/${groupId}/feed${editingId ? `/${editingId}` : ""}`,
        token,
        { method: editingId ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      if (file && !editingId) {
        const prepared = await api<{
          attachment: { id: string };
          upload: { url: string; headers: Record<string, string> };
        }>(
          `/projects/${projectId}/groups/${groupId}/feed/${post.id}/attachments/prepare`,
          token,
          {
            method: "POST",
            body: JSON.stringify({
              originalName: file.name,
              mimeType: file.type,
              size: file.size,
            }),
          },
        );
        const uploaded = await fetch(prepared.upload.url, {
          method: "PUT",
          headers: prepared.upload.headers,
          body: file,
        });
        if (!uploaded.ok) throw new Error("첨부파일 업로드에 실패했습니다.");
        await api(
          `/projects/${projectId}/groups/${groupId}/feed/${post.id}/attachments/${prepared.attachment.id}/complete`,
          token,
          { method: "POST" },
        );
      }
      resetComposer();
      await loadApiPosts(token);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "게시글을 저장하지 못했습니다.",
      );
    }
  };

  const addComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!openedPost || !comment.trim()) return;
    try {
      if (mode === "local") {
        const current = readLocalPosts(projectId, groupId);
        const next = current.map((post) => {
          if (post.id !== openedPost.id) return post;
          const newComment: Comment = {
            id: crypto.randomUUID(),
            content: comment.trim(),
            author: { name: "김지훈" },
            replies: [],
          };
          const comments = replyTo
            ? (post.comments ?? []).map((item) =>
                item.id === replyTo
                  ? { ...item, replies: [...item.replies, newComment] }
                  : item,
              )
            : [...(post.comments ?? []), newComment];
          return {
            ...post,
            comments,
            _count: {
              comments: comments.reduce(
                (sum, item) => sum + 1 + item.replies.length,
                0,
              ),
            },
          };
        });
        writeLocalPosts(projectId, groupId, next);
        setOpenedPost(next.find((post) => post.id === openedPost.id) ?? null);
        filterLocal();
      } else {
        await api(
          `/projects/${projectId}/groups/${groupId}/feed/${openedPost.id}/comments`,
          token,
          {
            method: "POST",
            body: JSON.stringify({
              content: comment,
              parentId: replyTo ?? undefined,
            }),
          },
        );
        await openPost(openedPost.id);
        await loadApiPosts(token);
      }
      setComment("");
      setReplyTo(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "댓글을 등록하지 못했습니다.",
      );
    }
  };

  const archive = async (postId: string) => {
    try {
      if (mode === "local") {
        writeLocalPosts(
          projectId,
          groupId,
          readLocalPosts(projectId, groupId).filter(
            (post) => post.id !== postId,
          ),
        );
        filterLocal();
      } else {
        await api(
          `/projects/${projectId}/groups/${groupId}/feed/${postId}`,
          token,
          { method: "DELETE" },
        );
        await loadApiPosts(token);
      }
      setOpenedPost(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "게시글을 보관하지 못했습니다.",
      );
    }
  };

  const download = async (postId: string, attachment: Attachment) => {
    try {
      if (mode === "local" && attachment.dataUrl) {
        const link = document.createElement("a");
        link.href = attachment.dataUrl;
        link.download = attachment.originalName;
        link.click();
        return;
      }
      const result = await api<{ url: string }>(
        `/projects/${projectId}/groups/${groupId}/feed/${postId}/attachments/${attachment.id}/download`,
        token,
      );
      window.location.assign(result.url);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "파일을 내려받지 못했습니다.",
      );
    }
  };

  const openNotification = async (item: NotificationItem) => {
    if (item.postId) await openPost(item.postId);
    if (mode === "api")
      await api(`/notifications/${item.id}/read`, token, { method: "PATCH" });
    setNotifications((current) =>
      current.filter((notification) => notification.id !== item.id),
    );
    setNotificationsOpen(false);
  };

  return (
    <section className="database-feed">
      <header className="db-feed-header">
        <div>
          <span>프로젝트 협업 그룹</span>
          <h2>{groupName}</h2>
          <p>
            {mode === "api"
              ? `PostgreSQL · 실시간 ${connected ? "연결됨" : "재연결 중"}`
              : "이 브라우저에 안전하게 저장되는 로컬 협업 피드"}
          </p>
        </div>
        <div className="db-header-actions">
          {mode === "local" && <b>로컬 저장 모드</b>}
          {mode === "api" && (
            <div className="db-notifications">
              <button
                type="button"
                aria-label={`읽지 않은 알림 ${notifications.length}개`}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                🔔<i>{notifications.length}</i>
              </button>
              {notificationsOpen && (
                <div>
                  {notifications.length === 0 ? (
                    <p>새 알림이 없습니다.</p>
                  ) : (
                    notifications.map((item) => (
                      <button
                        type="button"
                        onClick={() => void openNotification(item)}
                        key={item.id}
                      >
                        <strong>{item.message}</strong>
                        <small>이슈로 이동</small>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          <button type="button" onClick={() => setComposer(true)}>
            ＋ 새 게시글
          </button>
        </div>
      </header>
      <div className="db-feed-filters">
        <input
          aria-label="그룹 피드 검색"
          placeholder="제목, 내용, 태그 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="게시글 유형"
          value={type}
          onChange={(event) => setType(event.target.value as PostType | "")}
        >
          <option value="">전체 유형</option>
          {Object.entries(typeLabels).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="이슈 상태"
          value={status}
          onChange={(event) => setStatus(event.target.value as Status | "")}
        >
          <option value="">전체 상태</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <div className="db-feed-error" role="alert">
          {error}
        </div>
      )}
      {composer && (
        <form className="db-composer" onSubmit={savePost}>
          <div>
            <h3>{editingId ? "게시글 수정" : "새 게시글 작성"}</h3>
            <button type="button" onClick={resetComposer}>
              닫기
            </button>
          </div>
          <div className="db-composer-row">
            <select
              aria-label="작성 유형"
              value={postType}
              onChange={(event) => setPostType(event.target.value as PostType)}
            >
              {Object.entries(typeLabels).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="중요도"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              {Object.entries(priorityLabels).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="작성 상태"
              value={postStatus}
              onChange={(event) => setPostStatus(event.target.value as Status)}
            >
              {Object.entries(statusLabels).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <select
            aria-label="담당자"
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
          >
            <option value="">담당자 미지정</option>
            {assignees.map((item) => (
              <option value={item.user.id} key={item.user.id}>
                {item.user.name} · {item.organization.name}
              </option>
            ))}
          </select>
          <input
            aria-label="게시글 제목"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="제목"
            required
            minLength={2}
          />
          <textarea
            aria-label="게시글 내용"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="현황과 요청사항을 입력하세요. @이름으로 멘션할 수 있습니다."
            required
          />
          <small className="mention-help">
            예: @박민수 배관 검토 의견을 확인해 주세요.
          </small>
          <input
            aria-label="태그"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="태그를 쉼표로 구분"
          />
          {!editingId && (
            <label className="db-file">
              사진·파일 첨부
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,.dwg"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <span>{file?.name ?? "선택된 파일 없음"}</span>
            </label>
          )}
          <button className="db-save" type="submit">
            {editingId ? "수정 저장" : "게시글 등록"}
          </button>
        </form>
      )}
      <div className="db-post-list">
        {loading ? (
          <p className="db-feed-empty">피드를 불러오는 중입니다.</p>
        ) : posts.length === 0 ? (
          <p className="db-feed-empty">조건에 맞는 게시글이 없습니다.</p>
        ) : (
          posts.map((post) => (
            <article className="db-post" key={post.id}>
              <div className="db-post-meta">
                <span className={`type-${post.type.toLowerCase()}`}>
                  {typeLabels[post.type]}
                </span>
                <b>{statusLabels[post.status]}</b>
                <em>중요도 {priorityLabels[post.priority]}</em>
              </div>
              <button
                className="db-post-main"
                type="button"
                onClick={() => void openPost(post.id)}
              >
                <h3>{post.title}</h3>
                <p>{post.content}</p>
              </button>
              <div className="db-tags">
                {post.tags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
              <footer>
                <span>
                  {post.author.name}
                  {post.assignee ? ` · 담당 ${post.assignee.name}` : ""}
                </span>
                <span>댓글 {post._count?.comments ?? 0}</span>
                {canManagePosts ? <><button type="button" onClick={() => startEdit(post)}>
                  수정
                </button>
                <button type="button" onClick={() => void archive(post.id)}>
                  삭제
                </button></> : null}
              </footer>
            </article>
          ))
        )}
      </div>
      {openedPost && (
        <div className="db-detail">
          <div className="db-detail-head">
            <div>
              <span>{typeLabels[openedPost.type]}</span>
              <h3>{openedPost.title}</h3>
            </div>
            <button type="button" onClick={() => setOpenedPost(null)}>
              닫기
            </button>
          </div>
          <p>{openedPost.content}</p>
          {openedPost.attachments?.map((attachment) => (
            <button
              className="db-attachment"
              type="button"
              onClick={() => void download(openedPost.id, attachment)}
              key={attachment.id}
            >
              📎 {attachment.originalName} ·{" "}
              {Math.ceil(Number(attachment.size) / 1024)}KB
            </button>
          ))}
          <div className="db-comments">
            {openedPost.comments?.map((item) => (
              <div className="db-comment" key={item.id}>
                <strong>{item.author.name}</strong>
                <p>{item.content}</p>
                <button type="button" onClick={() => setReplyTo(item.id)}>
                  답글
                </button>
                {item.replies.map((reply) => (
                  <div className="db-reply" key={reply.id}>
                    <strong>{reply.author.name}</strong>
                    <p>{reply.content}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <form className="db-comment-form" onSubmit={addComment}>
            {replyTo && (
              <span>
                답글 작성 중{" "}
                <button type="button" onClick={() => setReplyTo(null)}>
                  취소
                </button>
              </span>
            )}
            <input
              aria-label="댓글 내용"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="댓글을 입력하세요."
            />
            <button type="submit">등록</button>
          </form>
        </div>
      )}
    </section>
  );
}
