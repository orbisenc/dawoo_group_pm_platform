"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { dawooProjects } from "../../lib/dawoo-projects";
import { useProject } from "./project-context";

type ProjectFilter = "전체" | "기획" | "개발 검토";

export function ProjectsWorkspace() {
  const { selectedProject, selectProject } = useProject();
  const [filter, setFilter] = useState<ProjectFilter>("전체");
  const [query, setQuery] = useState("");

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dawooProjects.filter((project) => {
      const matchesFilter = filter === "전체" || project.status === filter;
      const matchesQuery =
        !normalizedQuery ||
        `${project.name} ${project.location} ${project.category}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query]);

  return (
    <section className="dawoo-projects-page">
      <div className="dawoo-projects-heading">
        <div>
          <span>DAWOO GROUP PROJECT PORTFOLIO</span>
          <h2>다우그룹 주요 프로젝트</h2>
          <p>공식 웹사이트에 공개된 다우그룹 직접 프로젝트를 중심으로 협업 공간을 구성했습니다.</p>
        </div>
        <div className="portfolio-summary" aria-label="프로젝트 포트폴리오 요약">
          <span><b>3</b> 프로젝트</span>
          <span><b>3</b> 사업 영역</span>
          <span><b>1</b> 통합 허브</span>
        </div>
      </div>

      <div className="dawoo-project-toolbar">
        <div className="dawoo-filter-tabs" role="group" aria-label="프로젝트 상태 필터">
          {(["전체", "기획", "개발 검토"] as const).map((item) => (
            <button
              className={filter === item ? "active" : ""}
              type="button"
              onClick={() => setFilter(item)}
              key={item}
            >
              {item}
            </button>
          ))}
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
        {visibleProjects.map((project) => (
          <article
            className={selectedProject.id === project.id ? "dawoo-project-card selected" : "dawoo-project-card"}
            key={project.id}
          >
            <div className="dawoo-project-image">
              <Image src={project.image} alt={`${project.name} 대표 이미지`} fill sizes="(max-width: 760px) 100vw, 33vw" />
              <span>{project.category}</span>
              <b>{project.status}</b>
            </div>
            <div className="dawoo-project-card-body">
              <div className="project-card-code">
                <span>{project.code}</span>
                <small>{project.organization}</small>
              </div>
              <h3>{project.name}</h3>
              <p>{project.description}</p>
              <dl>
                {project.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="project-card-location">⌖ {project.location}</div>
              <footer>
                <button type="button" onClick={() => selectProject(project.id)}>
                  {selectedProject.id === project.id ? "현재 협업 프로젝트" : "협업 프로젝트로 선택"}
                </button>
                <Link href={project.sourceUrl} target="_blank" rel="noreferrer">
                  공식 정보 ↗
                </Link>
              </footer>
            </div>
          </article>
        ))}
      </div>
      {visibleProjects.length === 0 ? (
        <div className="project-search-empty">
          <strong>검색 결과가 없습니다.</strong>
          <span>다른 검색어나 상태를 선택해 주세요.</span>
        </div>
      ) : null}
      <p className="project-source-note">
        프로젝트 설명과 수치는 다우그룹 공식 웹사이트의 공개 정보를 기준으로 정리했습니다. 사업 계획은 인허가와 협의 과정에서 변경될 수 있습니다.
      </p>
    </section>
  );
}
