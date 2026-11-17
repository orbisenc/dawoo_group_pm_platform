"use client";

import Image from "next/image";
import Link from "next/link";

import { findDawooProject } from "../../lib/dawoo-projects";
import { useProject } from "./project-context";

const quickLinks = [
  { href: "/issues", label: "이슈", value: "8", description: "검토가 필요한 협업 항목" },
  { href: "/drive", label: "공유 파일", value: "24", description: "최근 등록된 프로젝트 문서" },
  { href: "/calendar", label: "일정", value: "6", description: "이번 달 주요 회의와 마감" },
  { href: "/approvals", label: "결재", value: "3", description: "현재 처리 대기 문서" },
];

export function ProjectOverview() {
  const { selectedProject } = useProject();
  const project = findDawooProject(selectedProject.id);

  return (
    <section className="dawoo-overview" aria-labelledby="project-overview-title">
      <div className="dawoo-overview-visual">
        <Image src={project.image} alt="" fill sizes="(max-width: 900px) 100vw, 55vw" priority />
        <div className="dawoo-overview-shade" />
        <div className="dawoo-overview-copy">
          <span>{project.category} · {project.organization}</span>
          <h2 id="project-overview-title">{project.name}</h2>
          <p>{project.description}</p>
          <div className="dawoo-overview-actions">
            <Link className="overview-primary" href="/projects">프로젝트 정보 보기</Link>
            <Link className="overview-secondary" href="/issues">협업 공간 열기</Link>
          </div>
        </div>
      </div>
      <div className="dawoo-overview-data">
        <div className="overview-location">
          <span>프로젝트 위치</span>
          <strong>{project.location}</strong>
          <b>{project.status}</b>
        </div>
        <div className="overview-facts">
          {project.facts.map((fact) => (
            <div key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>
        <div className="workspace-readiness">
          <div>
            <span>협업 공간 준비 상태</span>
            <strong>{project.workspaceReadiness}%</strong>
          </div>
          <div className="readiness-track" aria-label={`협업 공간 준비 상태 ${project.workspaceReadiness}%`}>
            <i style={{ width: `${project.workspaceReadiness}%` }} />
          </div>
          <small>업무 자료와 참여자 등록 기준이며 실제 사업 공정률이 아닙니다.</small>
        </div>
      </div>
      <div className="overview-quick-links" aria-label="프로젝트 주요 현황 바로가기">
        {quickLinks.map((item) => (
          <Link href={item.href} key={item.href}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.description}</small>
            <b aria-hidden="true">→</b>
          </Link>
        ))}
      </div>
    </section>
  );
}
