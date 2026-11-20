"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useProject } from "./project-context";
import { ProjectCreateDialog } from "./project-create-dialog";
import { useOptionalAuth } from "../auth/auth-context";

export function ProjectsWorkspace({ adminMode }: { adminMode?: boolean } = {}) {
  const { projects, selectedProject, selectProject, removeProject } = useProject();
  const auth = useOptionalAuth();
  const isAdmin = adminMode ?? auth?.isAdmin ?? false;
  const authorizedFetch = auth?.authorizedFetch;
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const editingProject = projects.find((project) => project.id === editingProjectId) ?? null;

  async function deleteProject(projectId: string, projectName: string) {
    if (!isAdmin || !window.confirm(`‘${projectName}’ 프로젝트를 삭제할까요? 삭제 후 목록에서 제거됩니다.`)) return;
    setActionError("");
    try {
      if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(projectId) && !auth?.token?.startsWith("local:")) {
        if (!authorizedFetch) throw new Error("관리자 로그인이 필요합니다.");
        const response = await authorizedFetch(`/projects/${projectId}`, { method: "DELETE" });
        if (!response.ok && response.status !== 404) throw new Error("프로젝트를 삭제하지 못했습니다.");
      }
      removeProject(projectId);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "프로젝트를 삭제하지 못했습니다.");
    }
  }

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return projects.filter((project) => {
      return (
        !normalizedQuery ||
        `${project.name} ${project.location ?? ""} ${project.category ?? project.period}`
          .toLowerCase()
          .includes(normalizedQuery)
      );
    });
  }, [projects, query]);

  return (
    <section className="dawoo-projects-page">
      <div className="dawoo-projects-heading">
        <div>
          <span>DAWOO GROUP PROJECT PORTFOLIO</span>
          <h2>다우그룹 주요 프로젝트</h2>
          <p>공식 웹사이트에 공개된 다우그룹 직접 프로젝트를 중심으로 협업 공간을 구성했습니다.</p>
        </div>
        <div className="portfolio-summary" aria-label="프로젝트 포트폴리오 요약">
          <span><b>{projects.length}</b> 프로젝트</span>
          <span><b>{new Set(projects.map((project) => project.category ?? project.period)).size}</b> 사업 영역</span>
          <span><b>1</b> 통합 허브</span>
        </div>
      </div>

      <div className="dawoo-project-toolbar">
        <div className="dawoo-filter-tabs" role="group" aria-label="프로젝트 목록">
          <button className="active" type="button">전체 {projects.length}</button>
          <button className="project-add-button" type="button" onClick={() => setCreateOpen(true)}>＋ 프로젝트 추가</button>
        </div>
        <label className="dawoo-project-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="프로젝트 검색"
            placeholder="프로젝트명, 지역, 사업 유형 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="dawoo-project-grid">
        {actionError ? <div className="project-action-error" role="alert">{actionError}</div> : null}
        {visibleProjects.map((project) => (
          <article
            className={selectedProject.id === project.id ? "dawoo-project-card selected" : "dawoo-project-card"}
            key={project.id}
          >
            <div className="dawoo-project-image">
              {project.image ? <Image src={project.image} alt={`${project.name} 대표 이미지`} fill sizes="(max-width: 760px) 100vw, 33vw" unoptimized={project.image.startsWith("data:")} /> : <div className="project-image-placeholder" aria-label="대표 이미지 미등록"><span aria-hidden="true">DW</span></div>}
              <span>{project.category ?? project.period}</span>
            </div>
            <div className="dawoo-project-card-body">
              <div className="project-card-code">
                <span>{project.code ?? "DW-PROJECT"}</span>
                <small>{project.organization ?? "(주)다우그룹"}</small>
              </div>
              <h3>{project.name}</h3>
              <p>{project.description ?? "새로 등록한 프로젝트입니다."}</p>
              <dl>
                {(project.facts ?? [{ label: "협업 공간", value: "준비 중" }]).map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="project-card-location">⌖ {project.location ?? "위치 미정"}</div>
              <footer>
                <button type="button" onClick={() => selectProject(project.id)}>
                  {selectedProject.id === project.id ? "현재 협업 프로젝트" : "협업 프로젝트로 선택"}
                </button>
                <button className="project-edit-button" type="button" onClick={() => setEditingProjectId(project.id)}>프로젝트 수정</button>
                {project.sourceUrl ? <Link href={project.sourceUrl} target="_blank" rel="noreferrer">공식 정보 ↗</Link> : <span className="project-local-label">직접 등록</span>}
                {isAdmin && projects.length > 1 ? <button className="project-delete-button" type="button" onClick={() => void deleteProject(project.id, project.name)}>프로젝트 삭제</button> : null}
              </footer>
            </div>
          </article>
        ))}
      </div>
      {visibleProjects.length === 0 ? (
        <div className="project-search-empty">
          <strong>검색 결과가 없습니다.</strong>
          <span>다른 검색어를 입력해 주세요.</span>
        </div>
      ) : null}
      <p className="project-source-note">
        프로젝트 설명과 수치는 다우그룹 공식 웹사이트의 공개 정보를 기준으로 정리했습니다. 사업 계획은 인허가와 협의 과정에서 변경될 수 있습니다.
      </p>
      {createOpen ? <ProjectCreateDialog open onClose={() => setCreateOpen(false)} /> : null}
      {editingProject ? <ProjectCreateDialog key={editingProject.id} open project={editingProject} onClose={() => setEditingProjectId(null)} /> : null}
    </section>
  );
}
