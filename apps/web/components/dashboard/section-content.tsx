import Link from "next/link";

import { InteractiveBuildingViewer } from "../viewer/interactive-building-viewer";
import {
  ApprovalWorkspace,
  CalendarWorkspace,
  DriveWorkspace,
} from "./functional-workspaces";
import { IssuesWorkspace } from "./issues-workspace";
import { ProjectsWorkspace } from "./projects-workspace";
import { AdminWorkspace } from "./admin-workspace";

function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: string;
}) {
  return (
    <div className="section-title">
      <div>
        <span className="sample-label">
          <i /> 샘플 데이터
        </span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action && (
        <button className="primary-button" type="button">
          + {action}
        </button>
      )}
    </div>
  );
}

function ProjectsScreen() {
  return <ProjectsWorkspace />;
}

function IssuesScreen() {
  return <IssuesWorkspace />;
}

function DriveScreen() {
  return <DriveWorkspace />;
}

function CalendarScreen() {
  return <CalendarWorkspace />;
}

function ViewerScreen() {
  return (
    <>
      <PageTitle
        title="3D/BIM 뷰어"
        description="자체 생성한 데모 건물의 객체와 공사 정보를 확인합니다."
      />
      <InteractiveBuildingViewer />
    </>
  );
}

function ApprovalsScreen() {
  return <ApprovalWorkspace />;
}

function CadScreen() {
  return (
    <>
      <PageTitle
        title="CAD 도면"
        description="향후 DWG 도면 연동을 위한 준비 화면입니다."
      />
      <section className="coming-soon">
        <div className="cad-visual">
          <span>A-201</span>
          <i />
          <i />
          <i />
          <i />
          <b>DWG</b>
        </div>
        <div>
          <span className="coming-badge">DWG 뷰어 연동 예정 · 현재 미지원</span>
          <h3>아직 DWG 파일을 표시하거나 변환하지 않습니다.</h3>
          <p>
            향후 검증된 변환 파이프라인을 통해 레이어 보기, 거리 측정과 이슈
            마크업을 제공할 예정입니다. 현재 화면은 실제 DWG 뷰어가 아니며 원본
            도면은 공유 드라이브에서 내려받을 수 있습니다.
          </p>
          <Link className="primary-button" href="/drive">
            공유 드라이브로 이동
          </Link>
        </div>
      </section>
    </>
  );
}

export function SectionContent({ slug }: { slug: string }) {
  if (slug === "projects") return <ProjectsScreen />;
  if (slug === "issues") return <IssuesScreen />;
  if (slug === "drive") return <DriveScreen />;
  if (slug === "calendar") return <CalendarScreen />;
  if (slug === "viewer") return <ViewerScreen />;
  if (slug === "cad") return <CadScreen />;
  if (slug === "approvals") return <ApprovalsScreen />;
  if (slug === "admin") return <AdminWorkspace />;
  return null;
}
