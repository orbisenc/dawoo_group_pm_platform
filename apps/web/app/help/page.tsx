import type { Metadata } from "next";

import { PublicDocument } from "../../components/public/public-document";

export const metadata: Metadata = { title: "사용자 도움말 | 다우그룹 PROJECT HUB" };

export default function HelpPage() {
  return (
    <PublicDocument title="사용자 도움말" updatedAt="2026. 11. 20.">
      <section><h2>로그인과 회원가입</h2><ol><li>회원가입 신청에서 이름, 아이디, 이메일과 비밀번호를 입력합니다.</li><li>플랫폼 관리자의 승인이 완료되면 로그인할 수 있습니다.</li><li>승인 후에도 로그인할 수 없다면 아이디를 확인하고 관리자에게 계정 상태 점검을 요청하세요.</li></ol></section>
      <section><h2>프로젝트와 이슈</h2><p>왼쪽 프로젝트 목록에서 작업할 프로젝트를 먼저 선택하세요. 이슈 피드에서는 제목, 본문, 담당자와 첨부파일을 등록할 수 있습니다. 접근할 수 없는 프로젝트는 목록과 검색 결과에 표시되지 않습니다.</p></section>
      <section><h2>공유 드라이브</h2><ol><li>공유 드라이브에서 Google 계정 연결을 선택하고 권한 요청을 확인합니다.</li><li>프로젝트 폴더에서 새 폴더를 만들거나 파일을 끌어 놓아 업로드합니다.</li><li>연결이 만료되면 다시 연결을 선택하세요. 비밀번호는 PROJECT HUB에 전달되지 않습니다.</li></ol></section>
      <section><h2>일정과 결재</h2><p>일정은 프로젝트 범위에서 생성하고 담당자를 지정합니다. 결재는 문서와 결재선을 확인한 뒤 상신하며, 현재 순번의 결재자만 승인 또는 반려할 수 있습니다. 반려 사유를 확인한 뒤 새 리비전으로 다시 상신하세요.</p></section>
      <section><h2>3D/BIM 뷰어</h2><p>현재 뷰어는 기능 확인용 데모 건물입니다. 마우스 또는 터치로 회전·이동·확대할 수 있으며 실제 IFC/DWG 업로드나 법정 도면 검토 기능은 제공하지 않습니다.</p></section>
      <section><h2>문제 해결</h2><ul><li>화면이 갱신되지 않으면 새로고침 후 다시 로그인합니다.</li><li>권한 오류가 나면 선택한 프로젝트와 본인의 멤버십을 확인합니다.</li><li>파일 업로드 실패 시 형식과 크기를 확인하고 재시도합니다.</li><li>문의할 때 화면, 발생 시각과 오류 화면의 요청 ID를 함께 전달합니다. 비밀번호나 OAuth 토큰은 보내지 마세요.</li></ul></section>
    </PublicDocument>
  );
}
