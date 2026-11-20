# 배포 및 롤백 런북

## 1. 배포 대상

- 웹: Next.js. Firebase Hosting은 정적 데모·외부 공유 화면에 사용한다.
- API: NestJS 장기 실행 환경. PostgreSQL·Redis·비공개 S3에 사설 연결되어야 한다.
- Firebase 정적 배포만으로는 서버 권한·감사·백업이 필요한 운영 MVP가 완성되지 않는다. 운영 출시 판정은 API 배포 주소와 비밀 저장소가 확정된 스테이징/운영 환경에서만 한다.

## 2. 배포 전 확인

1. 작업 트리가 의도한 변경만 포함하는지 확인한다.
2. `pnpm install --frozen-lockfile`
3. `pnpm check:launch`
4. `pnpm check:security`
5. 스테이징 백업을 생성하고 최근 복구 리허설 성공 기록을 확인한다.
6. 마이그레이션 SQL을 검토하고 파괴적 변경이 없는지 확인한다.
7. 운영에서 `ENABLE_DEV_AUTH=false`, 강한 `AUTH_TOKEN_SECRET`·`METRICS_TOKEN`, 허용된 `WEB_ORIGIN`을 확인한다.

## 3. API와 DB 배포

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd --filter @project-hub/api build
pnpm.cmd db:deploy
pnpm.cmd --filter @project-hub/api start
```

마이그레이션은 API 새 버전과 이전 버전이 모두 동작하는 확장 단계부터 적용한다. 공유된 마이그레이션은 수정하지 않는다. 배포 후 `/api/v1/health/ready`와 대표 권한 스모크 테스트를 실행한다.

## 4. Firebase 웹 배포

```powershell
pnpm.cmd build:firebase
npx.cmd --yes firebase-tools@latest deploy --only hosting --project dawoo-group-pm-platform
```

배포 후 외부 URL의 HTTP 200, 로그인 화면, 정책 문서와 Google OAuth 승인 원본을 확인한다. Firebase 릴리스 ID와 Git 커밋을 운영 기록에 남긴다.

## 5. 롤백

웹 롤백:

1. Firebase Console의 Hosting 릴리스 기록에서 직전 정상 버전을 선택한다.
2. 롤백 후 외부 URL과 정책 문서를 확인한다.
3. 원인 커밋을 새 수정 커밋으로 되돌린다. 공유 이력을 강제 재작성하지 않는다.

API 롤백:

1. 쓰기 트래픽을 중지하거나 유지보수 모드로 전환한다.
2. 직전 정상 이미지/아티팩트를 재배포한다.
3. 확장형 마이그레이션은 그대로 두고 이전 API 호환성을 확인한다.
4. 파괴적 DB 변경이 있었다면 임의 역마이그레이션하지 말고 상황 책임자 승인 후 검증된 백업으로 별도 복구한다.
5. 준비 상태와 권한 스모크 테스트가 통과하면 트래픽을 복원한다.

## 6. 배포 기록 양식

- 배포 시각/담당자:
- 환경과 버전(Git SHA, 웹 릴리스, API 이미지):
- 마이그레이션:
- `check:launch` / 보안 감사 결과:
- 백업·복구 리허설 ID:
- 배포 후 점검:
- 롤백 기준과 관찰 종료 시각:

실제 실행 기록은 [`deployments/`](./deployments/)에 날짜별로 보관한다.
