# Firebase Hosting 배포 기록 — 2026. 11. 25.

- 배포 시각: 2026. 11. 25. 07:29:04 KST
- 담당: 저장소 소유자가 승인한 Codex 작업
- 환경: Firebase Hosting 라이브 채널(정적 외부 공유 화면)
- 기능 Git 커밋: `c6bbbd8`
- 사이트: `dawoo-group-pm-platform`
- 외부 URL: <https://dawoo-group-pm-platform.web.app>
- CAD URL: <https://dawoo-group-pm-platform.web.app/cad/>
- Firebase 릴리스 ID: `1795559344386000`
- Firebase 버전 ID: `4464026f320ec316`
- 상태: `FINALIZED`
- 배포 파일: 90개, 15,642,541바이트

## 배포 내용

- CAD 도면 탭에 `CAD Viewer for Drive`를 내장하고 Google Drive의 DWG·DXF 선택 상태를 전달한다.
- 3D/BIM 탭에 Autodesk APS 기반 IFC·OBJ·STP·STEP·SKP 변환 및 뷰어 흐름을 추가한다.
- CAD·3D/BIM 작업 상태를 탭 이동 후에도 복원한다.
- Google Drive 파일 형식 심볼과 CAD·3D/BIM 고정 레이아웃을 반영한다.

## 배포 전 검증

- 린트 및 TypeScript 타입 검사: 통과
- 단위·통합 테스트: contracts 2개, 웹 70개, API 단위 58개, API E2E 34개 통과
- Playwright Chrome 데스크톱·모바일: 6개 통과
- `pnpm.cmd check:security`: critical/high 0개, moderate 6개
- `pnpm.cmd build:firebase`: 통과(정적 경로 14개)

## 배포 후 점검

| 경로 | 결과 |
| --- | --- |
| `/cad/` | HTTP 200, 배포 번들에서 `cadviewer.co/viewer`와 Google Drive CAD 뷰어 코드 확인 |
| `/viewer/` | HTTP 200, 배포 번들에서 Autodesk APS 3D/BIM 뷰어 코드 확인 |
| `/privacy/` | HTTP 200 |
| `/terms/` | HTTP 200 |

## 범위와 후속 확인

이번 배포는 Firebase Hosting 정적 웹 화면이다. Autodesk APS 변환 API는 별도 NestJS API 운영 배포와 서버 전용 `APS_CLIENT_ID`, `APS_CLIENT_SECRET` 설정이 있어야 실제 외부 변환이 동작한다. 자격증명은 웹 번들 및 Git에 포함하지 않았다.

실제 Google 계정의 DWG·DXF 열기와 실제 3D 모델 변환은 계정 권한, Google OAuth 허용 도메인, APS 무료 티어 한도에 영향을 받으므로 운영 계정으로 최종 사용자 인수 테스트를 수행한다. 화면 접근 실패, 정책 문서 404 또는 정적 자산 로드 실패가 확인되면 Firebase Hosting의 직전 정상 라이브 릴리스로 롤백한다.
