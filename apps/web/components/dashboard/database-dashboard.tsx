"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BuildingPreview } from "./building-preview";
import { projectOptions, useProject } from "./project-context";
import type { ProjectOption } from "./project-context";

type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
  updatedAt: string;
};
type Issue = {
  id: string;
  title: string;
  status: string;
  priority: string;
  updatedAt: string;
  project: { id: string; name: string };
  assignee?: { id: string; name: string } | null;
};
type Event = {
  id: string;
  title: string;
  kind: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  project: { id: string; name: string };
};
type FileItem = {
  id: string;
  name: string;
  updatedAt: string;
  project: { id: string; name: string };
  folder?: { id: string; name: string } | null;
  versions: Array<{
    id: string;
    version: number;
    size: string;
    mimeType: string;
    createdAt: string;
    uploadedBy?: { name: string };
  }>;
};
type Activity = {
  projectId: string;
  projectName: string;
  issueCount: number;
  eventCount: number;
  fileCount: number;
  pendingApprovalCount: number;
  lastActivityAt: string;
};
type DashboardData = {
  projects: Project[];
  selectedProjectId: string | null;
  myIssues: Issue[];
  unresolvedIssues: Issue[];
  upcomingEvents: Event[];
  recentFiles: FileItem[];
  pendingApprovalCount: number;
  projectActivity: Activity[];
};

const statusText: Record<string, string> = {
  REGISTERED: "등록",
  UNDER_REVIEW: "검토 중",
  IN_PROGRESS: "진행 중",
  ON_HOLD: "지연·보류",
  COMPLETED: "완료",
};

async function request<T>(path: string, token?: string) {
  const response = await fetch(`/backend${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new Error("대시보드 데이터를 불러오지 못했습니다.");
  return response.json() as Promise<T>;
}

function date(value: string, withTime = false) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="dashboard-empty">
      <span aria-hidden="true">◇</span>
      <strong>{title}</strong>
      <p>{description}</p>
      <Link href={href}>{action}</Link>
    </div>
  );
}

function sampleDashboard(
  selectedProjectId: string,
  projectOptions: ProjectOption[],
): DashboardData {
  const updatedAt = "2026-10-28T06:30:00.000Z";
  const projects = projectOptions.map((project, index) => ({
    id: project.id,
    code: `PRJ-${String(index + 1).padStart(2, "0")}`,
    name: project.name,
    status: "ACTIVE",
    updatedAt,
  }));
  const selectedProjectName =
    projectOptions.find((project) => project.id === selectedProjectId)?.name ??
    "선택 프로젝트";
  const project = { id: selectedProjectId, name: selectedProjectName };
  return {
    projects,
    selectedProjectId,
    myIssues: [
      {
        id: `${selectedProjectId}-issue-1`,
        title: "분양가·사업비 변동 수익성 민감도 검토",
        status: "UNDER_REVIEW",
        priority: "HIGH",
        updatedAt,
        project,
        assignee: { id: "sample-user", name: "김지훈" },
      },
      {
        id: `${selectedProjectId}-issue-2`,
        title: "인허가 보완사항 담당자 확인",
        status: "IN_PROGRESS",
        priority: "NORMAL",
        updatedAt,
        project,
        assignee: { id: "sample-user", name: "김지훈" },
      },
    ],
    unresolvedIssues: [
      {
        id: `${selectedProjectId}-risk-1`,
        title: "토지비 조달 및 브릿지론 구조 비교",
        status: "ON_HOLD",
        priority: "CRITICAL",
        updatedAt,
        project,
        assignee: { id: "sample-partner", name: "박민수" },
      },
    ],
    upcomingEvents: [
      {
        id: `${selectedProjectId}-event-1`,
        title: "주간 공정회의",
        kind: "MEETING",
        startsAt: "2026-10-30T05:00:00.000Z",
        endsAt: "2026-10-30T06:00:00.000Z",
        allDay: false,
        project,
      },
      {
        id: `${selectedProjectId}-event-2`,
        title: "인허가 접수",
        kind: "MILESTONE",
        startsAt: "2026-11-06T00:00:00.000Z",
        endsAt: "2026-11-07T00:00:00.000Z",
        allDay: true,
        project,
      },
    ],
    recentFiles: [
      {
        id: `${selectedProjectId}-file-1`,
        name: "설계도서_Rev.3.pdf",
        updatedAt,
        project,
        folder: { id: "sample-folder", name: "04_설계도면" },
        versions: [
          {
            id: "sample-version",
            version: 3,
            size: "12582912",
            mimeType: "application/pdf",
            createdAt: updatedAt,
            uploadedBy: { name: "이수현" },
          },
        ],
      },
    ],
    pendingApprovalCount: 2,
    projectActivity: [
      {
        projectId: selectedProjectId,
        projectName: selectedProjectName,
        issueCount: 7,
        eventCount: 4,
        fileCount: 18,
        pendingApprovalCount: 2,
        lastActivityAt: updatedAt,
      },
    ],
  };
}

export function DatabaseDashboard() {
  const { selectedProject, selectProject, replaceProjects } = useProject();
  const [data, setData] = useState<DashboardData | null>(null);
  const [source, setSource] = useState<"api" | "sample">("api");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sessionResponse = await fetch("/backend/auth/dev-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@projecthub.local" }),
      });
      if (!sessionResponse.ok) throw new Error();
      const session = (await sessionResponse.json()) as { accessToken: string };
      const next = await request<DashboardData>(
        `/dashboard?projectId=${encodeURIComponent(selectedProject.id)}`,
        session.accessToken,
      );
      setData(next);
      setSource("api");
      replaceProjects(
        next.projects.map((project, index) => ({
          id: project.id,
          name: project.name,
          period: project.status === "ACTIVE" ? "진행 중" : project.status,
          crop: `crop-${(index % 4) + 1}`,
        })),
      );
    } catch {
      setData(sampleDashboard(selectedProject.id, projectOptions));
      setSource("sample");
    } finally {
      setLoading(false);
    }
  }, [replaceProjects, selectedProject.id]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const sessionResponse = await fetch("/backend/auth/dev-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "admin@projecthub.local" }),
        });
        if (!sessionResponse.ok) throw new Error();
        const session = (await sessionResponse.json()) as {
          accessToken: string;
        };
        const next = await request<DashboardData>(
          `/dashboard?projectId=${encodeURIComponent(selectedProject.id)}`,
          session.accessToken,
        );
        if (active) {
          setData(next);
          setSource("api");
          replaceProjects(
            next.projects.map((project, index) => ({
              id: project.id,
              name: project.name,
              period: project.status === "ACTIVE" ? "진행 중" : project.status,
              crop: `crop-${(index % 4) + 1}`,
            })),
          );
        }
      } catch {
        if (active) {
          setData(sampleDashboard(selectedProject.id, projectOptions));
          setSource("sample");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [replaceProjects, selectedProject.id]);

  if (loading)
    return (
      <section className="live-dashboard-state" aria-live="polite">
        <span className="viewer-spinner" />
        <strong>프로젝트 현황을 불러오는 중입니다.</strong>
      </section>
    );
  if (error)
    return (
      <section className="live-dashboard-state error" role="alert">
        <strong>대시보드를 연결하지 못했습니다.</strong>
        <p>{error}</p>
        <button type="button" onClick={() => void load()}>
          다시 시도
        </button>
      </section>
    );
  if (!data) return null;

  return (
    <section className="live-dashboard">
      <nav className="dashboard-project-switcher" aria-label="프로젝트 선택">
        <strong>프로젝트</strong>
        {data.projects.map((project) => (
          <button
            className={selectedProject.id === project.id ? "active" : ""}
            type="button"
            onClick={() => selectProject(project.id)}
            key={project.id}
          >
            <span>{project.code}</span>
            {project.name}
          </button>
        ))}
      </nav>
      {source === "sample" && (
        <div className="dashboard-sample-notice" role="status">
          <strong>샘플 데이터</strong>
          <span>
            API와 데이터베이스 연결 전에도 프로젝트 전환을 확인할 수 있는 로컬
            미리보기입니다.
          </span>
        </div>
      )}
      <header className="live-dashboard-heading">
        <div>
          <span>선택 프로젝트 실시간 업무 현황</span>
          <h2>{selectedProject.name} 통합 대시보드</h2>
          <p>현재 선택한 프로젝트의 이슈, 일정, 문서와 결재 현황입니다.</p>
        </div>
        <div className="dashboard-summary">
          <article>
            <b>{data.projects.length}</b>
            <span>참여 프로젝트</span>
          </article>
          <article>
            <b>{data.myIssues.length}</b>
            <span>내 담당 미해결</span>
          </article>
          <article>
            <b>{data.pendingApprovalCount}</b>
            <span>결재 대기</span>
          </article>
        </div>
      </header>
      <div className="live-dashboard-grid">
        <article className="live-card dashboard-issues">
          <div className="live-card-head">
            <div>
              <span>MY ISSUES</span>
              <h3>내 담당 이슈</h3>
            </div>
            <Link href="/issues">이슈 피드 ›</Link>
          </div>
          {data.myIssues.length ? (
            <div className="live-list">
              {data.myIssues.map((issue) => (
                <Link href="/issues" className="live-issue" key={issue.id}>
                  <i className={`priority-${issue.priority.toLowerCase()}`} />
                  <div>
                    <strong>{issue.title}</strong>
                    <small>
                      {issue.project.name} ·{" "}
                      {issue.assignee?.name ?? "담당자 없음"}
                    </small>
                  </div>
                  <b>{statusText[issue.status] ?? issue.status}</b>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="담당 중인 이슈가 없습니다."
              description="새 업무가 배정되면 이곳에서 바로 확인할 수 있습니다."
              href="/issues"
              action="전체 이슈 보기"
            />
          )}
        </article>
        <article className="live-card dashboard-risk">
          <div className="live-card-head">
            <div>
              <span>OPEN & DELAYED</span>
              <h3>미해결·지연 이슈</h3>
            </div>
            <Link href="/issues">전체보기 ›</Link>
          </div>
          {data.unresolvedIssues.length ? (
            <div className="live-list">
              {data.unresolvedIssues.map((issue) => (
                <Link href="/issues" className="live-issue" key={issue.id}>
                  <i
                    className={
                      issue.status === "ON_HOLD"
                        ? "priority-critical"
                        : `priority-${issue.priority.toLowerCase()}`
                    }
                  />
                  <div>
                    <strong>{issue.title}</strong>
                    <small>
                      {issue.project.name} · {date(issue.updatedAt)} 갱신
                    </small>
                  </div>
                  <b className={issue.status === "ON_HOLD" ? "delayed" : ""}>
                    {statusText[issue.status] ?? issue.status}
                  </b>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="미해결 이슈가 없습니다."
              description="현재 접근 가능한 프로젝트에 열린 이슈가 없습니다."
              href="/issues"
              action="이슈 등록하기"
            />
          )}
        </article>
        <article className="live-card dashboard-schedule">
          <div className="live-card-head">
            <div>
              <span>NEXT 30 DAYS</span>
              <h3>다가오는 사업 일정</h3>
            </div>
            <Link href="/calendar">캘린더 ›</Link>
          </div>
          {data.upcomingEvents.length ? (
            <div className="live-list">
              {data.upcomingEvents.map((event) => (
                <Link href="/calendar" className="live-event" key={event.id}>
                  <time>
                    <b>
                      {new Date(event.startsAt).toLocaleDateString("ko-KR", {
                        timeZone: "Asia/Seoul",
                        day: "2-digit",
                      })}
                    </b>
                    <span>
                      {new Date(event.startsAt).toLocaleDateString("ko-KR", {
                        timeZone: "Asia/Seoul",
                        month: "short",
                      })}
                    </span>
                  </time>
                  <div>
                    <strong>{event.title}</strong>
                    <small>
                      {event.project.name} ·{" "}
                      {event.allDay ? "종일" : date(event.startsAt, true)}
                    </small>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="30일 이내 일정이 없습니다."
              description="사업 마일스톤이나 회의 일정을 등록해 보세요."
              href="/calendar"
              action="일정 등록하기"
            />
          )}
        </article>
        <article className="live-card dashboard-files">
          <div className="live-card-head">
            <div>
              <span>RECENT DOCUMENTS</span>
              <h3>최근 공유 문서</h3>
            </div>
            <Link href="/drive">공유 드라이브 ›</Link>
          </div>
          {data.recentFiles.length ? (
            <div className="live-list">
              {data.recentFiles.map((file) => (
                <Link href="/drive" className="live-file" key={file.id}>
                  <span>
                    {file.versions[0]?.mimeType.includes("pdf")
                      ? "PDF"
                      : "FILE"}
                  </span>
                  <div>
                    <strong>{file.name}</strong>
                    <small>
                      {file.project.name} · v{file.versions[0]?.version ?? 1} ·{" "}
                      {date(file.updatedAt)}
                    </small>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="공유된 문서가 없습니다."
              description="권한이 있는 폴더에 첫 문서를 업로드해 보세요."
              href="/drive"
              action="공유 드라이브 열기"
            />
          )}
        </article>
        <article className="live-card dashboard-activity">
          <div className="live-card-head">
            <div>
              <span>PROJECT ACTIVITY</span>
              <h3>프로젝트별 활동 현황</h3>
            </div>
            <Link href="/projects">프로젝트 ›</Link>
          </div>
          {data.projectActivity.length ? (
            <div className="activity-list">
              {data.projectActivity.map((activity) => (
                <div className="activity-row" key={activity.projectId}>
                  <div>
                    <strong>{activity.projectName}</strong>
                    <small>
                      최근 활동 {date(activity.lastActivityAt, true)}
                    </small>
                  </div>
                  <span>
                    <b>{activity.issueCount}</b> 이슈
                  </span>
                  <span>
                    <b>{activity.eventCount}</b> 일정
                  </span>
                  <span>
                    <b>{activity.fileCount}</b> 파일
                  </span>
                  <span
                    className={activity.pendingApprovalCount ? "waiting" : ""}
                  >
                    <b>{activity.pendingApprovalCount}</b> 결재
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="참여 중인 프로젝트가 없습니다."
              description="프로젝트 초대를 수락하면 활동 현황이 표시됩니다."
              href="/projects"
              action="프로젝트 확인"
            />
          )}
        </article>
        <article className="live-card dashboard-viewer">
          <div className="live-card-head inverse">
            <div>
              <span>3D DEMO</span>
              <h3>건물 모델 미리보기</h3>
            </div>
            <b>실제 BIM 연동 전</b>
          </div>
          <Link
            href="/viewer"
            className="live-viewer-link"
            aria-label="3D 데모 뷰어 진입"
          >
            <BuildingPreview compact />
            <span>인터랙티브 3D 뷰어 열기 →</span>
          </Link>
        </article>
      </div>
    </section>
  );
}
