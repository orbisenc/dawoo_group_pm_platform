# PROJECT HUB 출시 준비 증적

기준일: 2026. 11. 20.  
대상: 로드맵 8단계(MVP 안정화와 출시 준비)

이 문서는 기능 설명이 아니라 저장소의 코드, 자동 테스트, 실제 환경 실행 증적을 기준으로 출시 게이트를 판정한다. 실제 운영 Google 계정과 운영 데이터는 검증에 사용하지 않는다.

## 판정 기준

- **완료**: 저장소에서 반복 실행 가능한 자동 테스트 또는 목표 환경의 실행 기록이 있다.
- **미완료**: 구현이나 문서가 없거나, 필수 실행 기록이 없다.
- **확인 불가**: 코드 밖의 계정·인프라·담당자 승인이 필요하며 현재 환경에서 안전하게 검증할 수 없다.

## 1. PRD MVP 수용 시나리오

| # | 시나리오 | 판정 | 코드·테스트 근거 | 출시 차단 |
| --- | --- | --- | --- | --- |
| 1 | 관리자의 프로젝트 생성과 다른 조직 사용자 초대 | 미완료 | `collaboration.e2e-spec.ts`, `collaboration.controller.ts`에 API 동작과 권한 검증이 있으나 실제 PostgreSQL과 브라우저를 연결한 초대 여정 기록이 없다. | 예 |
| 2 | 초대 사용자의 로그인과 허용 프로젝트만 조회 | 미완료 | `auth.service.spec.ts`, `dashboard.service.spec.ts`, `project-access.policy.spec.ts`가 승인·멤버십 범위를 검증한다. 실제 초대 수락부터 브라우저 조회까지의 통합 기록은 없다. | 예 |
| 3 | 사진 첨부 이슈 등록과 다른 사용자의 댓글 | 미완료 | `feed.e2e-spec.ts`, `feed.service.spec.ts`, `issue-feed.test.tsx`가 API 범위·입력·UI를 검증한다. 실제 S3 호환 저장소 전송과 두 사용자 브라우저 여정 기록은 없다. | 예 |
| 4 | 공유 파일함 폴더, 파일, 새 버전 | 미완료 | `drive.e2e-spec.ts`, `drive.service.spec.ts`, `google-drive-workspace.test.tsx`와 로컬 PostgreSQL·RustFS에서 준비→사전 서명 PUT→완료→다운로드 SHA-256 일치까지 통과했다. Google OAuth 사용자 여정은 아직 없다. | 예 |
| 5 | 프로젝트 일정 등록과 대시보드 확인 | 미완료 | `calendar.e2e-spec.ts`, `calendar.service.spec.ts`, `dashboard.e2e-spec.ts`, `dashboard-interactions.test.tsx`가 API·UI를 각각 검증한다. 실제 DB를 포함한 브라우저 통합 기록은 없다. | 예 |
| 6 | 샘플 3D 모델 회전·이동·확대 | 완료 | `interactive-building-viewer.test.tsx`, `viewer-adapter.test.ts`, `launch-readiness.spec.ts`가 데모 범위, 오류 상태, 기본 조작을 데스크톱·모바일 Chromium에서 검증한다. | 아니오 |
| 7 | 결재 상신과 승인 또는 반려 | 미완료 | `approval.service.spec.ts`, `approval.e2e-spec.ts`, `functional-workspaces.test.tsx`가 상태·순번·권한·UI를 검증한다. 실제 PostgreSQL 트랜잭션과 복수 사용자 브라우저 여정 기록은 없다. | 예 |
| 8 | 권한 없는 직접 URL 및 API 접근 거부 | 완료(자동화 범위) | 각 API E2E의 인증·프로젝트 불일치 사례와 `project-access.policy.spec.ts`, `drive.service.spec.ts`, `feed.service.spec.ts`, `launch-readiness.spec.ts`가 기본 거부를 검증한다. 스테이징 전체 URL 표본은 UAT에서 재확인한다. | UAT 전까지 예 |
| 9 | 주요 행위의 감사 로그 기록 | 미완료 | 결재 이벤트는 `approval.service.ts`에서 동일 트랜잭션으로 기록하고, `audit-trail.interceptor.ts`는 프로젝트·멤버십·그룹·이슈·일정·파일 변경과 파일 접근을 요청 ID와 함께 기록한다. 로그인 임계치·로그아웃·Google 초대·권한 거부·감사 로그 조회/내보내기와 실제 DB 통합 테스트는 아직 없다. | 예 |

현재 자동화만으로 완료 판정 가능한 시나리오는 2/9개다. PRD가 통합 테스트와 브라우저 E2E를 모두 요구하므로 단위·컴포넌트·모킹 기반 API 테스트만으로 완료 수를 높이지 않는다.

## 2. 권한 회귀

| 항목 | 판정 | 근거 | 출시 차단 |
| --- | --- | --- | --- |
| 인증 토큰 변조·만료·비활성 계정 | 완료 | `auth-token.service.spec.ts`, `auth.service.spec.ts`, API E2E 인증 사례 | 아니오 |
| 프로젝트 멤버십과 역할 | 완료(자동화 범위) | `project-access.policy.spec.ts`, `collaboration.e2e-spec.ts`, `dashboard.service.spec.ts` | UAT 전까지 예 |
| 다른 프로젝트 리소스 ID 차단 | 완료(자동화 범위) | feed, drive, calendar, approval 서비스 및 E2E 테스트의 `projectId` 불일치·비멤버 사례 | UAT 전까지 예 |
| 제한 그룹·폴더 접근 | 완료(자동화 범위) | `drive.service.spec.ts`, `feed.service.spec.ts`, 관련 E2E | UAT 전까지 예 |
| 보호 모듈 전체 권한 매트릭스 | 미완료 | 허용·금지·비멤버·비활성·URL/리소스 불일치 6종을 모든 보호 엔드포인트에 일괄 적용한 매트릭스가 없다. | 예 |

## 3. Google Drive 검증

| 항목 | 판정 | 근거 | 출시 차단 |
| --- | --- | --- | --- |
| Gmail 승인 시 공유 드라이브 writer 초대 | 완료(모킹 범위) | `google-drive-invitation.service.spec.ts`의 Gmail 판별, 내구성 큐, 실패 재등록, `writer` 권한 생성 | 실제 검증 전까지 예 |
| OAuth 연결·권한 범위·토큰 만료·재연결 | 미완료 | 실제 OAuth 토큰 수명주기 구현과 자동 테스트가 없다. | 예 |
| 폴더 탐색·업로드·바로가기 처리 | 완료(컴포넌트 범위) | `google-drive-workspace.test.tsx` | 실제 검증 전까지 예 |
| 실제 Google 테스트 계정 검증 | 확인 불가 | 연결 계정에서 `다우그룹_공유 드라이브` 존재와 구성원 관리·편집 권한은 확인했다. 앱 전용 비운영 OAuth 테스트 사용자와 서비스 계정 키가 없어 G-01~G-10 실행은 남아 있다. | 예 |

## 4. 운영 준비

| 항목 | 판정 | 근거 | 출시 차단 |
| --- | --- | --- | --- |
| 요청 ID·구조화 로그·표준 오류 | 완료 | `observability/`, `observability.e2e-spec.ts` | 아니오 |
| 메트릭과 p95 측정 | 완료(로컬 격리 환경) | 500회·동시성 20에서 health p95 11.78ms, ready 40.75ms, dashboard 73.20ms, project 19.73ms, 실패 0건 | 운영 목표 환경 재확인 필요 |
| 장애 대응 문서 | 완료 | `OPERATIONS.md`, `INCIDENT_RESPONSE.md` | 아니오 |
| 백업·복구 자동화 | 완료 | `scripts/backup.ps1`, `scripts/restore-rehearsal.ps1`, `DATA_RETENTION.md` | 아니오 |
| PostgreSQL 복원과 객체 메타데이터 대조 리허설 | 완료(로컬 격리 환경) | 2026. 11. 20. PostgreSQL 임시 DB 복원, 사용자 2·프로젝트 1·감사 로그 4건 조회, 실제 `AVAILABLE` 객체 1건 대조 통과 | 운영 환경 재확인 필요 |
| 배포·롤백 절차 | 완료(문서) | `DEPLOYMENT.md` | 스테이징 리허설 전까지 예 |
| 스테이징 배포·롤백·장애 대응 실행 | 확인 불가 | 스테이징 대상과 배포 권한이 필요하다. | 예 |

## 5. 개인정보·정책·도움말

| 항목 | 판정 | 근거 | 출시 차단 |
| --- | --- | --- | --- |
| 개인정보 처리방침·이용약관·도움말 공개 화면 | 완료(초안) | `/privacy`, `/terms`, `/help`와 로그인 화면 링크 | 법무 승인 전까지 예 |
| 데이터 보존·삭제·복구 기준 | 완료(운영 초안) | `DATA_RETENTION.md` | 책임자 확정 전까지 예 |
| 법무·개인정보 책임자 승인 | 확인 불가 | 조직의 책임자, 사업자 정보, 실제 보존 의무와 위탁사 확정이 필요하다. | 예 |
| 사용자 도움말 UAT | 확인 불가 | 스테이징 사용자 검수가 필요하다. | 예 |

## 6. 현재 자동 검증 결과

실행 명령은 다음과 같다.

```powershell
pnpm.cmd check
pnpm.cmd test:e2e:web
pnpm.cmd check:security
pnpm.cmd test:performance
```

- 저장소 타입 검사, 단위·컴포넌트·API E2E, 웹/API 빌드: 2026. 11. 20. `pnpm.cmd check` 통과. contracts 2건, 웹 52건, API 단위 51건, API E2E 34건으로 총 139건이 통과했다.
- 브라우저 E2E: 2026. 11. 20. 로컬 Chrome의 데스크톱·모바일 프로젝트 6건 통과.
- 보안 의존성 검사: 2026. 11. 20. `pnpm.cmd check:security` 통과. critical/high 0건, moderate 6건. moderate 항목은 출시 전 위험 수용 또는 업데이트 계획이 필요하다.
- Docker Desktop 4.99.0, WSL 3.0.5, PostgreSQL 17, Redis 8, RustFS S3 호환 저장소를 설치·기동하고 마이그레이션 12건과 시드를 적용했다.
- 로컬 성능 기준과 실제 객체 1건을 포함한 복구 리허설은 통과했다. Google 앱 OAuth·서비스 계정과 외부 API 스테이징 UAT는 아직 실행 증적이 없다.

## 우선순위 작업 목록

1. **P0** 로그인·Google 초대·권한 거부 감사 이벤트와 감사 로그 조회/내보내기 권한 테스트를 완성하고 실제 DB에서 기록을 검증한다.
2. **P0** PostgreSQL, Redis, S3 호환 저장소를 갖춘 격리 검증 환경에서 시나리오 1~5, 7의 실제 통합 테스트를 실행한다.
3. **P0** 모든 보호 엔드포인트에 권한 매트릭스 회귀 테스트를 적용한다.
4. **P0** 비운영 Google 테스트 계정으로 G-01~G-10을 검증하고 OAuth 만료·재연결 테스트를 추가한다.
5. **P0** 외부 API 스테이징에서 성능 기준, 백업·복원·대조, 배포·롤백·장애 대응 리허설을 재실행한다.
6. **P0** 스테이징 UAT에서 차단 결함 0건을 확인한다.
7. **P1** 개인정보 처리방침·이용약관·보존 기준을 법무·개인정보 책임자가 승인하고 실제 사업자·위탁사 정보를 반영한다.
8. **P1** moderate 의존성 6건의 도달 가능성을 검토하고 위험 수용 또는 업데이트 이슈를 남긴다.

## 최종 판정

**8단계 진행 중 — 출시 불가.** 자동화와 운영 도구는 보강되었지만 PRD 9개 시나리오 전체, 감사 로그 범위, 실제 인프라·Google·스테이징 실행 증적이 아직 출시 게이트를 충족하지 않는다.
