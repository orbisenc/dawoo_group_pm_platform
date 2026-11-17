"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

const projectId =
  process.env.NEXT_PUBLIC_DEMO_PROJECT_ID ??
  "30000000-0000-4000-8000-000000000001";
const groupId =
  process.env.NEXT_PUBLIC_DEMO_GROUP_ID ??
  "40000000-0000-4000-8000-000000000001";
const localKey = `project-hub:calendar:v1:${projectId}`;
type View = "month" | "week" | "list";
type Kind = "EVENT" | "MILESTONE";
type Member = {
  role: string;
  user: { id: string; name: string };
  organization: { name: string };
};
type Group = { id: string; name: string };
type Issue = { id: string; title: string; groupId: string };
type Attachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: string;
  dataUrl?: string;
};
type CalendarItem = {
  id: string;
  kind: Kind;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  milestoneName?: string | null;
  reminderMinutes: number;
  createdBy: { id?: string; name: string };
  assignee?: { id: string; name: string } | null;
  group?: Group | null;
  issue?: Issue | null;
  participants: Array<{ user: { id: string; name: string } }>;
  attachments: Attachment[];
};
type Context = { groups: Group[]; members: Member[]; issues: Issue[] };
type Reminder = {
  id: string;
  scheduledAt: string;
  event: { id: string; title: string; startsAt: string; kind: Kind };
};
type Mode = "api" | "local";

const localContext: Context = {
  groups: [{ id: groupId, name: "설계·시공 협업 그룹" }],
  members: [
    {
      role: "CLIENT_ADMIN",
      user: { id: "local-kim", name: "김지훈" },
      organization: { name: "한강디벨롭먼트" },
    },
    {
      role: "EXTERNAL_PARTNER",
      user: { id: "local-park", name: "박민수" },
      organization: { name: "한빛건설" },
    },
  ],
  issues: [
    {
      id: "local-seed-1",
      title: "지하주차장 MEP 배관 간섭 검토 요청",
      groupId,
    },
  ],
};
const milestoneSeeds = [
  ["토지계약", "2026-10-30"],
  ["인허가 접수", "2026-11-20"],
  ["건축허가", "2027-02-15"],
  ["PF 약정", "2027-03-10"],
  ["착공", "2027-04-01"],
  ["골조 완료", "2027-12-20"],
  ["사용승인", "2028-09-15"],
  ["준공", "2028-10-31"],
] as const;

function initialItems(): CalendarItem[] {
  return milestoneSeeds.map(([title, day], index) => ({
    id: `milestone-${index}`,
    kind: "MILESTONE",
    title,
    description: `${title} 목표 일정입니다. 프로젝트 상황에 맞게 수정할 수 있습니다.`,
    startsAt: `${day}T00:00:00+09:00`,
    endsAt: `${day}T23:59:59+09:00`,
    allDay: true,
    milestoneName: title,
    reminderMinutes: 10080,
    createdBy: { id: "local-kim", name: "김지훈" },
    assignee: { id: "local-kim", name: "김지훈" },
    group: null,
    issue: null,
    participants: [],
    attachments: [],
  }));
}
function readLocal() {
  try {
    const value = window.localStorage.getItem(localKey);
    if (value) return JSON.parse(value) as CalendarItem[];
  } catch {
    /* 초기 샘플로 복구 */
  }
  const items = initialItems();
  window.localStorage.setItem(localKey, JSON.stringify(items));
  return items;
}
function writeLocal(items: CalendarItem[]) {
  window.localStorage.setItem(localKey, JSON.stringify(items));
}
function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
function keyOf(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dateTimeInput(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}
function fileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("첨부파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}
function displayDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

export function DatabaseCalendarWorkspace() {
  const [mode, setMode] = useState<Mode>("local");
  const [token, setToken] = useState("");
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(new Date(2026, 9, 28));
  const [selectedDay, setSelectedDay] = useState("2026-10-28");
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [context, setContext] = useState<Context>(localContext);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [composer, setComposer] = useState(false);
  const [editing, setEditing] = useState<CalendarItem | null>(null);
  const [opened, setOpened] = useState<CalendarItem | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<Kind>("EVENT");
  const [milestoneName, setMilestoneName] = useState("");
  const [startsAt, setStartsAt] = useState("2026-10-28T09:00");
  const [endsAt, setEndsAt] = useState("2026-10-28T10:00");
  const [allDay, setAllDay] = useState(false);
  const [group, setGroup] = useState("");
  const [assignee, setAssignee] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [issue, setIssue] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState(1440);
  const [file, setFile] = useState<File | null>(null);

  const range = useMemo(() => {
    if (view === "week") {
      const start = new Date(cursor);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    start.setDate(start.getDate() - 7);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 8);
    return { start, end };
  }, [cursor, view]);
  const load = useCallback(
    async (accessToken = token, nextMode = mode) => {
      if (nextMode === "local") {
        const lowered = query.toLowerCase();
        setItems(
          readLocal().filter(
            (item) =>
              !lowered ||
              `${item.title} ${item.description ?? ""} ${item.milestoneName ?? ""}`
                .toLowerCase()
                .includes(lowered),
          ),
        );
        return;
      }
      const params = new URLSearchParams({
        from: range.start.toISOString(),
        to: range.end.toISOString(),
      });
      if (query.trim()) params.set("query", query.trim());
      const result = await api<{ items: CalendarItem[] }>(
        `/projects/${projectId}/calendar?${params}`,
        accessToken,
      );
      setItems(result.items);
    },
    [mode, query, range.end, range.start, token],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/backend/auth/dev-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "admin@projecthub.local" }),
        });
        if (!response.ok) throw new Error();
        const session = (await response.json()) as { accessToken: string };
        const [calendarContext, notice] = await Promise.all([
          api<Context>(
            `/projects/${projectId}/calendar/context`,
            session.accessToken,
          ),
          api<Reminder[]>(
            `/projects/${projectId}/calendar/reminders`,
            session.accessToken,
          ),
        ]);
        if (!active) return;
        setToken(session.accessToken);
        setMode("api");
        setContext(calendarContext);
        setReminders(notice);
        await load(session.accessToken, "api");
      } catch {
        if (!active) return;
        setMode("local");
        setContext(localContext);
        const local = readLocal();
        setItems(local);
        setReminders(
          local
            .filter(
              (item) =>
                item.assignee?.id === "local-kim" &&
                new Date(item.startsAt).getTime() -
                  item.reminderMinutes * 60000 <=
                  Date.now(),
            )
            .slice(0, 10)
            .map((item) => ({
              id: `reminder-${item.id}`,
              scheduledAt: new Date(
                new Date(item.startsAt).getTime() -
                  item.reminderMinutes * 60000,
              ).toISOString(),
              event: {
                id: item.id,
                title: item.title,
                startsAt: item.startsAt,
                kind: item.kind,
              },
            })),
        );
      }
    })();
    return () => {
      active = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        void load().catch((reason: unknown) =>
          setError(
            reason instanceof Error
              ? reason.message
              : "일정을 불러오지 못했습니다.",
          ),
        ),
      150,
    );
    return () => window.clearTimeout(timer);
  }, [load]);

  const reset = () => {
    setComposer(false);
    setEditing(null);
    setTitle("");
    setDescription("");
    setKind("EVENT");
    setMilestoneName("");
    setGroup("");
    setAssignee("");
    setParticipantIds([]);
    setIssue("");
    setReminderMinutes(1440);
    setFile(null);
  };
  const startCreate = (day = selectedDay) => {
    reset();
    const start = new Date(`${day}T09:00:00`);
    const end = new Date(start.getTime() + 3600000);
    setStartsAt(dateTimeInput(start));
    setEndsAt(dateTimeInput(end));
    setComposer(true);
  };
  const startEdit = (item: CalendarItem) => {
    setEditing(item);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setKind(item.kind);
    setMilestoneName(item.milestoneName ?? "");
    setStartsAt(dateTimeInput(item.startsAt));
    setEndsAt(dateTimeInput(item.endsAt));
    setAllDay(item.allDay);
    setGroup(item.group?.id ?? "");
    setAssignee(item.assignee?.id ?? "");
    setParticipantIds(
      item.participants.map((participant) => participant.user.id),
    );
    setIssue(item.issue?.id ?? "");
    setReminderMinutes(item.reminderMinutes);
    setComposer(true);
    setOpened(null);
  };
  const toggleParticipant = (id: string) =>
    setParticipantIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const body = {
        kind,
        title,
        description: description || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        allDay,
        milestoneName:
          kind === "MILESTONE" ? milestoneName || title : undefined,
        groupId: group || (editing ? null : undefined),
        assigneeId: assignee || (editing ? null : undefined),
        participantIds,
        issueId: issue || (editing ? null : undefined),
        reminderMinutes,
      };
      let saved: CalendarItem;
      if (mode === "local") {
        const current = readLocal();
        const member = context.members.find(
          (item) => item.user.id === assignee,
        )?.user;
        const item: CalendarItem = {
          id: editing?.id ?? uid(),
          ...body,
          description: description || null,
          milestoneName: kind === "MILESTONE" ? milestoneName || title : null,
          group: context.groups.find((item) => item.id === group) ?? null,
          assignee: member ?? null,
          issue: context.issues.find((item) => item.id === issue) ?? null,
          createdBy: editing?.createdBy ?? { id: "local-kim", name: "김지훈" },
          participants: participantIds.map((id) => ({
            user: context.members.find(
              (memberItem) => memberItem.user.id === id,
            )?.user ?? { id, name: "참여자" },
          })),
          attachments: editing?.attachments ?? [],
        };
        if (file)
          item.attachments.push({
            id: uid(),
            originalName: file.name,
            mimeType: file.type,
            size: String(file.size),
            dataUrl: await fileDataUrl(file),
          });
        const next = editing
          ? current.map((old) => (old.id === editing.id ? item : old))
          : [...current, item];
        writeLocal(next);
        saved = item;
      } else {
        saved = await api<CalendarItem>(
          `/projects/${projectId}/calendar${editing ? `/${editing.id}` : ""}`,
          token,
          { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) },
        );
        if (file) {
          const prepared = await api<{
            attachment: { id: string };
            upload: { url: string; headers: Record<string, string> };
          }>(
            `/projects/${projectId}/calendar/${saved.id}/attachments/prepare`,
            token,
            {
              method: "POST",
              body: JSON.stringify({
                originalName: file.name,
                mimeType: file.type || "application/octet-stream",
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
            `/projects/${projectId}/calendar/${saved.id}/attachments/${prepared.attachment.id}/complete`,
            token,
            { method: "POST" },
          );
        }
      }
      setSelectedDay(keyOf(saved.startsAt));
      reset();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "일정을 저장하지 못했습니다.",
      );
    }
  };
  const archive = async (item: CalendarItem) => {
    if (!window.confirm(`‘${item.title}’ 일정을 삭제할까요?`)) return;
    try {
      if (mode === "local")
        writeLocal(readLocal().filter((entry) => entry.id !== item.id));
      else
        await api(`/projects/${projectId}/calendar/${item.id}`, token, {
          method: "DELETE",
        });
      setOpened(null);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "일정을 삭제하지 못했습니다.",
      );
    }
  };
  const download = async (item: CalendarItem, attachment: Attachment) => {
    if (mode === "local" && attachment.dataUrl) {
      const link = document.createElement("a");
      link.href = attachment.dataUrl;
      link.download = attachment.originalName;
      link.click();
      return;
    }
    try {
      const result = await api<{ url: string }>(
        `/projects/${projectId}/calendar/${item.id}/attachments/${attachment.id}/download`,
        token,
      );
      window.location.assign(result.url);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "첨부파일을 내려받지 못했습니다.",
      );
    }
  };
  const openReminder = async (reminder: Reminder) => {
    const item =
      items.find((entry) => entry.id === reminder.event.id) ??
      (mode === "local"
        ? readLocal().find((entry) => entry.id === reminder.event.id)
        : await api<CalendarItem>(
            `/projects/${projectId}/calendar/${reminder.event.id}`,
            token,
          ));
    if (item) {
      setOpened(item);
      setSelectedDay(keyOf(item.startsAt));
    }
    if (mode === "api")
      await api(
        `/projects/${projectId}/calendar/reminders/${reminder.id}/read`,
        token,
        { method: "PATCH" },
      );
    setReminders((current) =>
      current.filter((entry) => entry.id !== reminder.id),
    );
    setReminderOpen(false);
  };

  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [cursor]);
  const weekDays = useMemo(() => {
    const start = new Date(cursor);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [cursor]);
  const eventsOn = (day: Date | string) =>
    items.filter((item) => keyOf(item.startsAt) === keyOf(day));
  const selectedItems = eventsOn(selectedDay);
  const navigate = (direction: number) =>
    setCursor((current) => {
      const next = new Date(current);
      if (view === "week") next.setDate(next.getDate() + direction * 7);
      else next.setMonth(next.getMonth() + direction);
      return next;
    });

  return (
    <section className="project-calendar">
      <header className="calendar-workspace-title">
        <div>
          <span className="sample-label">
            <i /> 프로젝트 일정
          </span>
          <h2>건설 개발사업 캘린더</h2>
          <p>
            {mode === "api"
              ? "PostgreSQL에 저장되는 프로젝트·그룹 일정"
              : "이 브라우저에 저장되는 로컬 일정 모드"}
          </p>
        </div>
        <div className="calendar-title-actions">
          <div className="calendar-reminders">
            <button
              type="button"
              aria-label={`일정 알림 ${reminders.length}개`}
              onClick={() => setReminderOpen((open) => !open)}
            >
              🔔 <b>{reminders.length}</b>
            </button>
            {reminderOpen && (
              <div>
                {reminders.length === 0 ? (
                  <p>새 일정 알림이 없습니다.</p>
                ) : (
                  reminders.map((reminder) => (
                    <button
                      type="button"
                      onClick={() => void openReminder(reminder)}
                      key={reminder.id}
                    >
                      <strong>{reminder.event.title}</strong>
                      <small>{displayDate(reminder.event.startsAt)}</small>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => startCreate()}
          >
            + 일정 등록
          </button>
        </div>
      </header>
      <div className="calendar-toolbar">
        <div className="view-switch">
          <button
            className={view === "month" ? "active" : ""}
            onClick={() => setView("month")}
            type="button"
          >
            월간
          </button>
          <button
            className={view === "week" ? "active" : ""}
            onClick={() => setView("week")}
            type="button"
          >
            주간
          </button>
          <button
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
            type="button"
          >
            목록형
          </button>
        </div>
        <div className="calendar-navigator">
          <button type="button" onClick={() => navigate(-1)}>
            ‹
          </button>
          <strong>
            {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
          </strong>
          <button type="button" onClick={() => navigate(1)}>
            ›
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(2026, 9, 28))}
          >
            오늘
          </button>
        </div>
        <input
          aria-label="일정 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="일정·마일스톤 검색"
        />
      </div>
      {error && (
        <div className="db-feed-error" role="alert">
          {error}
        </div>
      )}
      {composer && (
        <form className="calendar-composer" onSubmit={save}>
          <div>
            <h3>{editing ? "일정 수정" : "새 일정 등록"}</h3>
            <button type="button" onClick={reset}>
              닫기
            </button>
          </div>
          <div className="calendar-form-grid">
            <label>
              구분
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as Kind)}
              >
                <option value="EVENT">일반 일정</option>
                <option value="MILESTONE">마일스톤</option>
              </select>
            </label>
            <label>
              담당자
              <select
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
              >
                <option value="">미지정</option>
                {context.members.map((member) => (
                  <option value={member.user.id} key={member.user.id}>
                    {member.user.name} · {member.organization.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              협업 그룹
              <select
                value={group}
                onChange={(event) => {
                  setGroup(event.target.value);
                  setIssue("");
                }}
              >
                <option value="">프로젝트 전체</option>
                {context.groups.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              알림
              <select
                value={reminderMinutes}
                onChange={(event) =>
                  setReminderMinutes(Number(event.target.value))
                }
              >
                <option value={0}>시작 시각</option>
                <option value={60}>1시간 전</option>
                <option value={1440}>1일 전</option>
                <option value={10080}>1주 전</option>
                <option value={43200}>30일 전</option>
              </select>
            </label>
          </div>
          <input
            aria-label="일정 제목"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="일정 제목"
            required
            minLength={2}
          />
          {kind === "MILESTONE" && (
            <input
              aria-label="마일스톤 이름"
              value={milestoneName}
              onChange={(event) => setMilestoneName(event.target.value)}
              placeholder="예: PF 약정, 착공, 준공"
            />
          )}
          <textarea
            aria-label="일정 설명"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="일정 내용과 준비사항을 입력하세요."
          />
          <div className="calendar-time-row">
            <label>
              시작
              <input
                aria-label="시작 일시"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
              />
            </label>
            <label>
              종료
              <input
                aria-label="종료 일시"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                required
              />
            </label>
            <label className="all-day">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(event) => setAllDay(event.target.checked)}
              />{" "}
              종일
            </label>
          </div>
          <label className="participant-picker">
            참여자
            <span>
              {context.members.map((member) => (
                <button
                  className={
                    participantIds.includes(member.user.id) ? "selected" : ""
                  }
                  type="button"
                  onClick={() => toggleParticipant(member.user.id)}
                  key={member.user.id}
                >
                  {member.user.name}
                </button>
              ))}
            </span>
          </label>
          <label>
            관련 이슈
            <select
              aria-label="관련 이슈"
              value={issue}
              onChange={(event) => setIssue(event.target.value)}
              disabled={!group}
            >
              <option value="">연결 안 함</option>
              {context.issues
                .filter((item) => item.groupId === group)
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title}
                  </option>
                ))}
            </select>
          </label>
          <label className="calendar-file">
            첨부파일
            <input
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <span>{file?.name ?? "파일 선택"}</span>
          </label>
          <button className="calendar-save" type="submit">
            {editing ? "수정 저장" : "일정 등록"}
          </button>
        </form>
      )}
      <div className="calendar-main">
        <div className="calendar-view">
          {view === "month" && (
            <>
              <div className="calendar-week-labels">
                {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="calendar-month-grid">
                {monthDays.map((day) => (
                  <button
                    type="button"
                    className={`${day.getMonth() !== cursor.getMonth() ? "muted " : ""}${keyOf(day) === selectedDay ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedDay(keyOf(day));
                      setCursor(day);
                    }}
                    onDoubleClick={() => startCreate(keyOf(day))}
                    key={keyOf(day)}
                  >
                    <time>{day.getDate()}</time>
                    {eventsOn(day)
                      .slice(0, 3)
                      .map((item) => (
                        <i
                          className={
                            item.kind === "MILESTONE" ? "milestone" : "event"
                          }
                          key={item.id}
                        >
                          {item.kind === "MILESTONE" ? "◆ " : ""}
                          {item.title}
                        </i>
                      ))}
                    {eventsOn(day).length > 3 && (
                      <small>+{eventsOn(day).length - 3}개</small>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
          {view === "week" && (
            <div className="calendar-week-grid">
              {weekDays.map((day) => (
                <section
                  className={keyOf(day) === selectedDay ? "selected" : ""}
                  key={keyOf(day)}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedDay(keyOf(day))}
                  >
                    <span>
                      {["일", "월", "화", "수", "목", "금", "토"][day.getDay()]}
                    </span>
                    <strong>{day.getDate()}</strong>
                  </button>
                  {eventsOn(day).map((item) => (
                    <button
                      className={item.kind.toLowerCase()}
                      type="button"
                      onClick={() => setOpened(item)}
                      key={item.id}
                    >
                      <time>
                        {item.allDay
                          ? "종일"
                          : new Date(item.startsAt).toLocaleTimeString(
                              "ko-KR",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                      </time>
                      <strong>{item.title}</strong>
                      <small>{item.assignee?.name ?? "담당자 미지정"}</small>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          )}
          {view === "list" && (
            <div className="calendar-list">
              {items.length === 0 ? (
                <p>조건에 맞는 일정이 없습니다.</p>
              ) : (
                items.map((item) => (
                  <button
                    type="button"
                    onClick={() => {
                      setOpened(item);
                      setSelectedDay(keyOf(item.startsAt));
                    }}
                    key={item.id}
                  >
                    <time>
                      <b>{new Date(item.startsAt).getDate()}</b>
                      {new Intl.DateTimeFormat("ko-KR", {
                        month: "short",
                        weekday: "short",
                      }).format(new Date(item.startsAt))}
                    </time>
                    <span className={item.kind.toLowerCase()}>
                      {item.kind === "MILESTONE" ? "마일스톤" : "일정"}
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.description || "설명 없음"}</small>
                    </div>
                    <em>{item.assignee?.name ?? "미지정"}</em>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <aside className="calendar-agenda">
          <span>{selectedDay.replaceAll("-", ". ")}</span>
          <h3>
            선택한 일정 <b>{selectedItems.length}</b>
          </h3>
          {selectedItems.map((item) => (
            <button
              type="button"
              onClick={() => setOpened(item)}
              className={item.kind.toLowerCase()}
              key={item.id}
            >
              <time>
                {item.allDay
                  ? "종일"
                  : new Date(item.startsAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
              </time>
              <strong>{item.title}</strong>
              <small>
                {item.group?.name ?? "프로젝트 전체"} ·{" "}
                {item.assignee?.name ?? "담당자 미지정"}
              </small>
            </button>
          ))}
          {selectedItems.length === 0 && (
            <p>
              등록된 일정이 없습니다.
              <button type="button" onClick={() => startCreate()}>
                이 날짜에 등록
              </button>
            </p>
          )}
        </aside>
      </div>
      {opened && (
        <aside className="calendar-detail">
          <div>
            <span className={opened.kind.toLowerCase()}>
              {opened.kind === "MILESTONE" ? "마일스톤" : "프로젝트 일정"}
            </span>
            <button type="button" onClick={() => setOpened(null)}>
              닫기
            </button>
          </div>
          <h3>{opened.title}</h3>
          <p>{opened.description || "등록된 설명이 없습니다."}</p>
          <dl>
            <div>
              <dt>기간</dt>
              <dd>
                {displayDate(opened.startsAt)}
                <br />~ {displayDate(opened.endsAt)}
              </dd>
            </div>
            <div>
              <dt>담당자</dt>
              <dd>{opened.assignee?.name ?? "미지정"}</dd>
            </div>
            <div>
              <dt>참여자</dt>
              <dd>
                {opened.participants.map((item) => item.user.name).join(", ") ||
                  "미지정"}
              </dd>
            </div>
            <div>
              <dt>프로젝트/그룹</dt>
              <dd>용산 리버파크 / {opened.group?.name ?? "전체"}</dd>
            </div>
            {opened.issue && (
              <div>
                <dt>관련 이슈</dt>
                <dd>{opened.issue.title}</dd>
              </div>
            )}
          </dl>
          {opened.attachments.map((attachment) => (
            <button
              className="calendar-attachment"
              type="button"
              onClick={() => void download(opened, attachment)}
              key={attachment.id}
            >
              📎 {attachment.originalName}
            </button>
          ))}
          <div className="calendar-detail-actions">
            <button type="button" onClick={() => startEdit(opened)}>
              수정
            </button>
            <button type="button" onClick={() => void archive(opened)}>
              삭제
            </button>
          </div>
        </aside>
      )}
    </section>
  );
}
