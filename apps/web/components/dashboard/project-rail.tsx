"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useProject } from "./project-context";
import { ProjectCreateDialog } from "./project-create-dialog";

export function ProjectRail({ compact = false }: { compact?: boolean }) {
  const { projects, selectedProject, selectProject } = useProject();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const visibleProjects = useMemo(
    () => projects.filter((project) => project.name.toLowerCase().includes(query.trim().toLowerCase())),
    [projects, query],
  );

  return (
    <aside className={compact ? "project-rail compact" : "project-rail"}>
      <div className="rail-heading"><div><span>DAWOO GROUP</span><h2>프로젝트</h2></div><div className="rail-heading-actions"><button type="button" aria-label="새 프로젝트 추가" onClick={() => setCreateOpen(true)}>＋</button><Link href="/projects" aria-label="전체 프로젝트 보기">→</Link></div></div>
      <label className="rail-search"><span aria-hidden="true">⌕</span><input aria-label="프로젝트 검색" placeholder="프로젝트 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="rail-tabs">
        <button className="active" type="button">전체 <b>{projects.length}</b></button>
      </div>
      <div className="project-rail-list">
        {visibleProjects.map((project) => (
          <button className={selectedProject.id === project.id ? "rail-project active" : "rail-project"} onClick={() => selectProject(project.id)} type="button" key={project.id}>
            <span className="rail-project-image">
              {project.image ? <Image src={project.image} alt="" fill sizes="64px" unoptimized={project.image.startsWith("data:")} /> : null}
            </span>
            <span><strong>{project.name}</strong><small>{project.period}</small></span>
          </button>
        ))}
        {visibleProjects.length === 0 ? <p className="rail-empty">검색 결과가 없습니다.</p> : null}
      </div>
      <div className="rail-favorites"><span>바로가기</span><Link href="/projects">▣　다우그룹 프로젝트 전체</Link><Link href="/drive">▤　공유 문서 저장소</Link></div>
      {createOpen ? <ProjectCreateDialog open onClose={() => setCreateOpen(false)} /> : null}
    </aside>
  );
}
