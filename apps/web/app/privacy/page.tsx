import type { Metadata } from "next";

import { PublicDocument } from "../../components/public/public-document";

export const metadata: Metadata = { title: "개인정보 처리방침 | 다우그룹 PROJECT HUB" };

export default function PrivacyPage() {
  return (
    <PublicDocument title="개인정보 처리방침" updatedAt="2026. 11. 20.">
      <section><h2>1. 처리 목적</h2><p>PROJECT HUB는 회원가입 승인, 프로젝트 참여자 확인, 이슈·파일·일정·결재 협업, 보안 감사와 장애 대응을 위해 필요한 정보만 처리합니다.</p></section>
      <section><h2>2. 처리하는 정보</h2><ul><li>계정: 이름, 아이디, 이메일, 암호화된 비밀번호, 계정 상태와 역할</li><li>업무: 프로젝트 멤버십, 게시글·댓글, 일정, 결재와 감사 이력</li><li>파일: 원본 파일명, 형식, 크기, 저장소 식별자와 버전 정보</li><li>운영: 요청 ID, 내부 사용자·프로젝트 ID, 응답 상태와 처리시간</li><li>Google Drive 연결 시: 사용자가 동의한 계정 식별 정보와 Drive 작업에 필요한 OAuth 권한</li></ul><p>비밀번호 원문, Google 비밀번호, 파일 본문과 개인정보 본문은 운영 로그에 기록하지 않습니다.</p></section>
      <section><h2>3. 보유 및 삭제</h2><ul><li>승인 대기·거절 계정: 결정 후 30일 이내 삭제</li><li>활성 계정과 프로젝트 업무자료: 이용 또는 프로젝트 계약 종료 시까지</li><li>삭제한 이슈·댓글: 복구를 위해 30일 보관 후 영구 삭제</li><li>보안·접근 로그: 90일</li><li>결재·감사 기록: 업무상 책임 추적을 위해 프로젝트 종료 후 1년</li></ul><p>법령 또는 별도 계약에서 더 긴 보존을 요구하면 해당 기간 동안 접근을 제한하여 보관합니다. 삭제 요청 시 보존 의무가 없는 정보는 30일 이내 안전하게 삭제합니다.</p></section>
      <section><h2>4. 외부 서비스와 처리위탁</h2><p>공유 파일 기능에는 Google Drive가 사용되며 Google의 개인정보 처리방침과 사용자의 Google Workspace 정책이 함께 적용됩니다. 이슈 첨부파일은 비공개 S3 호환 저장소에 보관하고, 공개 링크로 전환하지 않습니다.</p></section>
      <section><h2>5. 이용자의 권리</h2><p>이용자는 플랫폼 관리자에게 본인 정보의 열람, 정정, 삭제, 처리 제한과 Google Drive 연결 해제를 요청할 수 있습니다. 프로젝트 기록의 삭제는 다른 참여자의 권리와 감사·계약상 보존 필요성을 확인한 후 처리됩니다.</p></section>
      <section><h2>6. 안전성 확보 조치</h2><p>프로젝트 멤버십 기반 접근제어, 비밀번호 단방향 해시, 비공개 저장소, 짧은 수명의 다운로드 URL, 요청 ID 기반 보안 로그, 관리자 권한 분리와 정기 백업을 적용합니다.</p></section>
      <section><h2>7. 문의</h2><p>개인정보 관련 요청은 소속 조직의 PROJECT HUB 플랫폼 관리자에게 전달해 주세요. 운영 관리자는 요청 접수일, 처리 담당자와 완료 결과를 기록합니다.</p></section>
    </PublicDocument>
  );
}
