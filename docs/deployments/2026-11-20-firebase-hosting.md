# Firebase Hosting 배포 기록 — 2026. 11. 20.

- 배포 시각: 2026. 11. 20. 15:05:41 KST
- 담당: 저장소 소유자가 승인한 Codex 작업
- 환경: Firebase Hosting 라이브 채널(정적 외부 공유 화면)
- Git 커밋: `2ed3c91`
- 사이트: `dawoo-group-pm-platform`
- 외부 URL: <https://dawoo-group-pm-platform.web.app>
- Firebase 릴리스 ID: `1795154741365000`
- Firebase 버전 ID: `8a5cbbe77cbdb586`
- 상태: `FINALIZED`
- 배포 파일: 94개, 14,761,768바이트

## 배포 전 검증

- `pnpm.cmd check`: 통과(contracts 2, 웹 52, API 단위 51, API E2E 34, 총 139개 테스트)
- Playwright Chrome 데스크톱·모바일: 6개 통과
- `pnpm.cmd check:security`: critical/high 0개, moderate 6개
- `pnpm.cmd build:firebase`: 통과(정적 경로 14개)

## 배포 후 점검

| 경로 | 결과 |
| --- | --- |
| `/` | HTTP 200, `PROJECT HUB` 확인 |
| `/privacy/` | HTTP 200 |
| `/terms/` | HTTP 200 |
| `/help/` | HTTP 200 |

## 범위와 롤백 기준

이번 배포는 정적 웹 외부 공유 화면만 포함한다. API, PostgreSQL, Redis, 객체 저장소가 있는 외부 스테이징 배포가 아니므로 서버 권한·감사·백업·Google 서비스 계정 검증의 출시 증적으로 사용하지 않는다.

화면 접근 실패, 정책 문서 404, 정적 자산 로드 실패가 확인되면 Firebase Hosting의 직전 정상 라이브 릴리스로 롤백한다. 현재 점검에서는 롤백 조건이 발생하지 않았다.
