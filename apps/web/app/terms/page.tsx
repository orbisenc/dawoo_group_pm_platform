import type { Metadata } from "next";

import { PublicDocument } from "../../components/public/public-document";

export const metadata: Metadata = { title: "이용약관 | 다우그룹 PROJECT HUB" };

export default function TermsPage() {
  return (
    <PublicDocument title="이용약관" updatedAt="2026. 11. 20.">
      <section><h2>1. 목적과 적용</h2><p>이 약관은 다우그룹 PROJECT HUB가 제공하는 건설 개발사업 협업 기능의 이용 조건과 이용자·관리자의 책임을 정합니다. 별도 프로젝트 계약과 충돌하는 경우 해당 계약을 우선합니다.</p></section>
      <section><h2>2. 계정과 승인</h2><p>회원가입은 플랫폼 관리자의 승인 후 효력이 발생합니다. 이용자는 본인의 계정을 공유해서는 안 되며 계정 도용이나 권한 오부여를 발견하면 즉시 관리자에게 알려야 합니다.</p></section>
      <section><h2>3. 허용된 사용</h2><p>이용자는 배정된 프로젝트와 업무 목적 범위에서만 정보를 열람·작성·다운로드해야 합니다. 다른 프로젝트 접근 시도, 보안 기능 우회, 악성 파일 업로드, 타인의 권리 침해와 서비스 방해 행위는 금지됩니다.</p></section>
      <section><h2>4. 자료와 권리</h2><p>이용자가 등록한 업무자료의 권리와 책임은 해당 이용자 또는 소속 조직에 있습니다. 서비스 운영자는 기능 제공, 백업, 보안 점검과 장애 복구에 필요한 범위에서만 자료를 처리합니다.</p></section>
      <section><h2>5. 전자결재의 범위</h2><p>PROJECT HUB 결재는 프로젝트 내부의 순차 승인과 이력 관리 기능입니다. 인증서 기반 전자서명 또는 법률상 서면·인감 절차를 자동으로 대체하지 않습니다.</p></section>
      <section><h2>6. 서비스 변경과 중단</h2><p>점검, 보안 사고 또는 외부 서비스 장애로 기능이 일시 중단될 수 있습니다. 계획된 점검은 사전 안내하고, 장애 시 운영 문서에 따라 복구 현황과 후속 조치를 공유합니다.</p></section>
      <section><h2>7. 이용 제한과 종료</h2><p>보안 위반, 프로젝트 종료 또는 조직 관리자의 요청이 있으면 계정을 정지하거나 프로젝트 접근을 회수할 수 있습니다. 종료 후 자료는 개인정보 처리방침과 프로젝트 계약의 보존 기준에 따라 처리합니다.</p></section>
      <section><h2>8. 문의와 변경</h2><p>약관 문의는 소속 조직의 플랫폼 관리자에게 전달해 주세요. 중요한 변경은 시행 전에 로그인 화면 또는 서비스 알림으로 안내합니다.</p></section>
    </PublicDocument>
  );
}
