import Link from "next/link";

import { InteractiveBuildingViewer } from "../viewer/interactive-building-viewer";
import {
  ApprovalWorkspace,
  CalendarWorkspace,
  DriveWorkspace,
} from "./functional-workspaces";
import { IssuesWorkspace } from "./issues-workspace";
import { ProjectsWorkspace } from "./projects-workspace";

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

function AdminScreen() {
  const members = [
    ["김지훈", "한강디벨롭먼트", "프로젝트 관리자", "활성"],
    ["이수현", "아크원 건축사사무소", "프로젝트 PM", "활성"],
    ["박민수", "대한건설", "참여자", "활성"],
    ["최예진", "용산구청 협의팀", "검토자", "초대됨"],
  ];
  return (
    <>
      <PageTitle
        title="프로젝트 관리자"
        description="프로젝트 참여자와 역할, 접근 범위를 관리합니다."
        action="참여자 초대"
      />
      <div className="admin-grid">
        <aside className="settings-menu">
          <button className="active">멤버 및 권한</button>
          <button>프로젝트 정보</button>
          <button>알림 설정</button>
          <button>감사 로그</button>
          <button>저장공간</button>
        </aside>
        <section className="data-panel admin-table">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">MEMBERS</span>
              <h3>참여자 48명</h3>
            </div>
            <span className="demo-chip light">샘플 데이터</span>
          </div>
          <div className="data-head member-columns">
            <span>이름</span>
            <span>소속 조직</span>
            <span>프로젝트 역할</span>
            <span>상태</span>
          </div>
          {members.map((row) => (
            <div className="data-row member-columns" key={row[0]}>
              <span>
                <i className="mini-avatar">{row[0]?.[0]}</i>
                <strong>{row[0]}</strong>
              </span>
              <span>{row[1]}</span>
              <span>{row[2]}</span>
              <span>
                <b className="member-status">{row[3]}</b>　⋮
              </span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
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
  if (slug === "admin") return <AdminScreen />;
  return null;
}
