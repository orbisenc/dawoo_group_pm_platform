"use client";

import Image from "next/image";
import Link from "next/link";

import { useProject } from "./project-context";

export function ProjectOverview() {
  const { selectedProject } = useProject();
  const project = selectedProject;

  return (
    <section className="dawoo-overview" aria-labelledby="project-overview-title">
      <div className="dawoo-overview-visual">
        {project.image ? <Image src={project.image} alt="" fill sizes="(max-width: 900px) 100vw, 55vw" priority unoptimized={project.image.startsWith("data:")} /> : <div className="overview-image-placeholder" aria-hidden="true">DW</div>}
        <div className="dawoo-overview-shade" />
        <div className="dawoo-overview-copy">
          <span>{project.category ?? project.period} · {project.organization ?? "(주)다우그룹"}</span>
          <h2 id="project-overview-title">{project.name}</h2>
          <p>{project.description ?? "새로 등록한 프로젝트의 협업 공간입니다."}</p>
          <div className="dawoo-overview-actions">
            <Link className="overview-primary" href="/projects">프로젝트 정보 보기</Link>
            <Link className="overview-secondary" href="/issues">협업 공간 열기</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
