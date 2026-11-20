"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

import { useAuth } from "../auth/auth-context";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  projectId: string;
  groupId: string;
  postId: string | null;
  createdAt: string;
};

const localNotificationPrefix = "project-hub-local-notifications:";

function initialLocalNotifications(): NotificationItem[] {
  const now = Date.now();
  return [
    {
      id: "local-profitability-review",
      type: "decision.requested",
      message: "의왕 학의지구 수익성 민감도 검토 의견이 요청되었습니다.",
      projectId: "local-project",
      groupId: "local-group",
      postId: "local-post-1",
      createdAt: new Date(now - 12 * 60 * 1000).toISOString(),
    },
    {
      id: "local-financing-review",
      type: "comment.created",
      message: "토지비 조달 및 브릿지론 비교안에 새 의견이 등록되었습니다.",
      projectId: "local-project",
      groupId: "local-group",
      postId: "local-post-2",
      createdAt: new Date(now - 48 * 60 * 1000).toISOString(),
    },
    {
      id: "local-schedule-reminder",
      type: "schedule.reminder",
      message: "금융기관 사업성 검토 회의가 내일 오전 10시에 예정되어 있습니다.",
      projectId: "local-project",
      groupId: "local-group",
      postId: null,
      createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function localStorageKey(userId: string) {
  return `${localNotificationPrefix}${userId}`;
}

function readLocalNotifications(userId: string) {
  const key = localStorageKey(userId);
  const stored = window.localStorage.getItem(key);
  if (stored) return JSON.parse(stored) as NotificationItem[];
  const items = initialLocalNotifications();
  window.localStorage.setItem(key, JSON.stringify(items));
  return items;
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    ...(sameDay ? { hour: "2-digit", minute: "2-digit" } : { month: "2-digit", day: "2-digit" }),
  }).format(date);
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path d="M10 21h4" />
    </svg>
  );
}

export function NotificationCenter() {
  const { token, user, authorizedFetch } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const localMode = token?.startsWith("local:") ?? false;

  const refresh = useCallback(async () => {
    if (!token || !user) return;
    setError("");
    if (localMode) {
      setItems(readLocalNotifications(user.id));
      setLoading(false);
      return;
    }
    try {
      const response = await authorizedFetch("/notifications/unread");
      if (!response.ok) throw new Error("알림을 불러오지 못했습니다.");
      setItems(await response.json() as NotificationItem[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "알림을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch, localMode, token, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (!token || localMode) return;
    const socket = io(process.env.NEXT_PUBLIC_API_SOCKET_URL ?? "http://localhost:4000", {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
    });
    socket.on("notification:new", () => void refresh());
    return () => {
      socket.disconnect();
    };
  }, [localMode, refresh, token]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function markRead(item: NotificationItem) {
    if (!user) return;
    if (localMode) {
      const next = items.filter((notification) => notification.id !== item.id);
      window.localStorage.setItem(localStorageKey(user.id), JSON.stringify(next));
      setItems(next);
      setOpen(false);
      return;
    }
    const response = await authorizedFetch(`/notifications/${item.id}/read`, { method: "PATCH" });
    if (!response.ok) {
      setError("알림을 읽음 처리하지 못했습니다.");
      return;
    }
    setItems((current) => current.filter((notification) => notification.id !== item.id));
    setOpen(false);
  }

  async function markAllRead() {
    if (!user || items.length === 0) return;
    setError("");
    if (localMode) {
      window.localStorage.setItem(localStorageKey(user.id), "[]");
      setItems([]);
      return;
    }
    const results = await Promise.all(items.map((item) => authorizedFetch(`/notifications/${item.id}/read`, { method: "PATCH" })));
    if (results.some((response) => !response.ok)) {
      setError("일부 알림을 읽음 처리하지 못했습니다.");
      await refresh();
      return;
    }
    setItems([]);
  }

  return (
    <div className="header-notification-center" ref={rootRef}>
      <button
        className={open ? "icon-button active" : "icon-button"}
        type="button"
        aria-label={`읽지 않은 알림 ${items.length}개`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <BellIcon />
        {items.length > 0 ? <i>{items.length > 99 ? "99+" : items.length}</i> : null}
      </button>
      {open ? (
        <section className="header-notification-panel" role="dialog" aria-label="알림 목록">
          <header>
            <div>
              <strong>알림</strong>
              <span>읽지 않음 {items.length}개</span>
            </div>
            <button type="button" disabled={items.length === 0} onClick={() => void markAllRead()}>모두 읽음</button>
          </header>
          {error ? <p className="notification-error" role="alert">{error}</p> : null}
          <div className="header-notification-list">
            {loading ? <p className="notification-empty">알림을 불러오는 중입니다.</p> : null}
            {!loading && items.length === 0 ? <p className="notification-empty">새로운 알림이 없습니다.</p> : null}
            {!loading ? items.map((item) => (
              <Link href={item.postId ? "/issues" : "/calendar"} key={item.id} onClick={() => void markRead(item)}>
                <span className="notification-symbol"><BellIcon /></span>
                <span>
                  <strong>{item.message}</strong>
                  <small>{formatNotificationTime(item.createdAt)} · 눌러서 확인</small>
                </span>
              </Link>
            )) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
