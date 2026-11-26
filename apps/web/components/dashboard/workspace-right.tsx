"use client";

import Link from "next/link";

import { DashboardApartmentPreview } from "./dashboard-apartment-preview";
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
          <Link href="/model-status">3D 모델 현황 열기</Link>
          <div>
            <b>GLB</b>
            <span>고정 모델</span>
          </div>
        </div>
        <div className="dashboard-viewer-preview">
          <DashboardApartmentPreview />
        </div>
      </div>
      <div className="right-widgets">
        <DashboardSharedDriveCard />
        <TeamupCalendar />
        <DashboardApprovalCard />
      </div>
    </section>
  );
}
