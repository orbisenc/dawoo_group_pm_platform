"use client";

import Link from "next/link";

import { BuildingPreview } from "./building-preview";
import {
  DashboardApprovalCard,
  DashboardSharedDriveCard,
} from "./dashboard-work-widgets";
import { useProject } from "./project-context";
import { TeamupCalendar } from "./teamup-calendar";

export function WorkspaceRight() {
  const { selectedProject } = useProject();

  return (
    <section className="workspace-right">
      <div className="bim-viewer-card">
        <div className="bim-toolbar">
          <strong>{selectedProject.name} · BIM 통합 모델 미리보기</strong>
          <Link href="/viewer">인터랙티브 뷰어 열기</Link>
          <div>
            <b>DEMO</b>
            <span>고해상도 샘플</span>
          </div>
        </div>
        <Link
          className="dashboard-viewer-preview"
          href="/viewer"
          aria-label="3D 데모 모델 뷰어로 이동"
        >
          <BuildingPreview compact />
        </Link>
      </div>
      <div className="right-widgets">
        <DashboardSharedDriveCard />
        <TeamupCalendar />
        <DashboardApprovalCard />
      </div>
    </section>
  );
}
