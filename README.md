# PROJECT HUB

건설 개발사업 참여자를 위한 웹 기반 프로젝트 협업 플랫폼입니다. 현재 저장소는 로드맵 **단계 8: MVP 안정화와 출시 준비**를 진행 중이며, 단계 1~7의 기능과 권한 기반을 전체 회귀 테스트·운영 검증 대상으로 다룹니다. 출시 판정과 남은 외부 검증은 [출시 준비 증적](docs/LAUNCH_READINESS.md)을 기준으로 확인합니다.

## 구성

| 구성요소     | 기술                             | 기본 주소                        |
| ------------ | -------------------------------- | -------------------------------- |
| 웹           | Next.js 16, React 19, TypeScript | <http://localhost:3004>          |
| API          | NestJS 11, Prisma                | <http://localhost:4000/api/v1>   |
| API 문서     | OpenAPI / Swagger                | <http://localhost:4000/api/docs> |
| 데이터베이스 | PostgreSQL 17                    | `localhost:5432`                 |
| 캐시·작업 큐 | Redis 8, BullMQ                  | `localhost:6379`                 |
| 파일 저장소  | RustFS(S3 호환)                  | <http://localhost:9000>          |
| 저장소 콘솔  | RustFS Console                   | <http://localhost:9001>          |

웹은 `/backend/*` 요청을 NestJS의 `/api/v1/*`로 전달합니다. 첫 화면의 **개발 환경 연결 상태** 카드가 `GET /api/v1/health`를 호출하여 실제 연결 여부를 표시합니다.

## 사전 요구사항

- Node.js 22.12 이상
- pnpm 11
- Docker Desktop 또는 Docker Engine과 Compose 플러그인

Windows PowerShell에서는 실행 정책의 영향을 받지 않도록 `pnpm.cmd`를 사용할 수 있습니다.

## 처음 실행하기

### 1. 환경변수 준비

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

`.env.example`의 값은 로컬 개발 전용입니다. 운영 환경에서는 안전한 비밀 값으로 교체하고 저장소에 커밋하지 마세요.

### 2. 의존성 설치

```powershell
pnpm.cmd install
```

### 3. PostgreSQL, Redis, RustFS 실행

```powershell
pnpm.cmd infra:up
```

상태 확인:

```powershell
docker compose ps
```

`postgres`, `redis`, `object-storage`가 실행 중이고 `object-storage-init`가 종료 코드 0이면 정상입니다. 초기화 컨테이너는 비공개 `project-hub-local` 버킷을 한 번 생성하고 종료합니다.

### 4. 데이터베이스 마이그레이션과 시드

```powershell
pnpm.cmd db:generate
pnpm.cmd db:deploy
pnpm.cmd db:seed
```

- `db:generate`: Prisma Client 생성
- `db:migrate`: 개발 중 새 마이그레이션 생성·적용
- `db:deploy`: 저장소에 포함된 마이그레이션 적용
- `db:seed`: 로컬 데모 조직과 프로젝트 생성

초기 마이그레이션은 사용자, 조직, 프로젝트와 각 멤버십 테이블 및 역할 enum을 생성합니다.

### 5. 웹과 API 실행

```powershell
pnpm.cmd dev
```

브라우저에서 <http://localhost:3004>을 열고 **PROJECT HUB API 정상 작동 중**이 표시되는지 확인합니다.

별도 터미널에서 실행하려면:

```powershell
pnpm.cmd dev:api
pnpm.cmd dev:web
```

### 프로젝트 협업 API

보호 API는 `Authorization: Bearer <서명 토큰>`을 요구합니다. 토큰은 `AUTH_TOKEN_SECRET`으로 HMAC 서명되고 만료시간을 검증하며, 요청 본문의 사용자·역할·조직 값은 권한 근거로 사용하지 않습니다. 회원가입 승인, 로그인·로그아웃과 현재 사용자 조회가 구현되어 있습니다.

로컬 웹 피드 확인을 위해 `.env.example`은 `ENABLE_DEV_AUTH=true`를 사용합니다. 이때 `admin@projecthub.local` 시드 사용자로 8시간 개발 세션을 발급합니다. 개발 세션 API는 `NODE_ENV=production`이거나 플래그가 꺼져 있으면 `404`이며 운영 인증 수단으로 사용할 수 없습니다.

주요 경로:

- `POST /api/v1/projects`, `PATCH /api/v1/projects/:projectId`
- `GET|POST /api/v1/projects/:projectId/members`
- `PATCH|DELETE /api/v1/projects/:projectId/members/:memberId/...`
- `GET|POST /api/v1/projects/:projectId/groups`
- `GET|PATCH /api/v1/projects/:projectId/groups/:groupId`
- `POST|PATCH|DELETE /api/v1/projects/:projectId/groups/:groupId/members/...`

모든 그룹 조회는 URL의 `projectId`와 그룹의 실제 `project_id`를 동시에 조건으로 사용합니다. 다른 프로젝트 데이터는 존재 여부를 숨기기 위해 `404`로 응답합니다.

### 그룹별 이슈 피드 API

그룹 피드는 게시글 유형 `NOTICE`, `GENERAL`, `QUESTION`, `ISSUE`, `DECISION`과 상태 `REGISTERED`, `UNDER_REVIEW`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`를 지원합니다.

- `GET|POST /api/v1/projects/:projectId/groups/:groupId/feed`
- `GET|PATCH|DELETE /api/v1/projects/:projectId/groups/:groupId/feed/:postId`
- `POST .../feed/:postId/comments` — 댓글, `parentId` 지정 시 답글
- `POST .../feed/:postId/attachments/prepare` — S3 직접 업로드 URL 준비
- `POST .../feed/:postId/attachments/:attachmentId/complete` — 업로드 객체 확인 및 첨부 확정
- `GET .../feed/:postId/attachments/:attachmentId/download` — 권한 재검증 후 5분 다운로드 URL 발급

검색과 필터는 `query`, `type`, `status`, `priority`, `tag`, `page`, `pageSize` 쿼리를 사용합니다. 게시글·댓글·첨부 메타데이터는 PostgreSQL에 저장되므로 서버 재시작과 새로고침 이후에도 유지됩니다. 본문은 일반 텍스트만 허용하고 HTML·제어문자를 거부하며, 첨부는 허용된 확장자와 MIME 조합, 최대 50MB, 실제 S3 객체 크기를 서버에서 검사합니다.

### 실시간 협업

웹은 `NEXT_PUBLIC_API_SOCKET_URL`의 Socket.IO 서버에 Bearer 토큰으로 연결합니다. 연결 후 `group:subscribe`에서 프로젝트·그룹 권한을 다시 확인한 사용자만 그룹 룸에 참여합니다.

- `realtime:event`: 새 댓글, 이슈 상태 변경, 멘션, 담당자 할당
- `notification:new`: 사용자별 읽지 않은 알림 갱신
- `group:sync`: 마지막 수신 시각 이후의 DB 저장 이벤트 재동기화
- `notifications:unread`: 읽지 않은 알림 목록
- `PATCH /api/v1/notifications/:notificationId/read`: 알림 읽음 처리

이벤트는 PostgreSQL에 고유 `event_key`로 기록한 뒤 Redis Pub/Sub로 전달합니다. DB 고유키, API 전달 캐시, 브라우저 이벤트 캐시가 동일 이벤트의 중복 처리를 막습니다. Redis 장애 중에도 현재 API 인스턴스에는 전달되며 재접속 시 DB 이벤트 동기화로 누락을 복구합니다.

### 프로젝트 공유 드라이브

웹의 **공유 드라이브** 메뉴는 프로젝트별 독립 폴더 탐색, 전체 파일명 검색, 드래그 앤 드롭 업로드·이동, 업로드 진행률과 실패 재시도, 파일 업로드·다운로드, PDF/이미지 미리보기, 이름 변경, 삭제, 버전 이력과 이슈 연결을 지원합니다. API와 로컬 인프라가 실행 중이면 메타데이터는 PostgreSQL, 파일 원본은 비공개 S3 호환 저장소에 저장됩니다. API를 실행하지 않은 화면 확인 환경에서는 브라우저 로컬 저장 모드로 자동 전환되며 이 모드는 파일당 2MB로 제한됩니다.

화면 상단의 저장소 선택에서 **Google Drive**로 전환하면 사용자의 Google 계정에 생성되는 PROJECT HUB 전용 폴더를 검색하고, 폴더 생성, 파일 업로드, 이름 변경, 열기 및 휴지통 이동을 수행할 수 있습니다. Firebase 외부 배포와 Google OAuth 설정 방법은 [Firebase Hosting 및 Google Drive 연동](docs/GOOGLE_DRIVE_FIREBASE.md)을 참고합니다.

새 프로젝트의 기본 폴더는 `01_사업관리`, `02_토지계약`, `03_인허가`, `04_설계도면`, `05_금융PF`, `06_계약발주`, `07_공사공정`, `08_회의록`입니다.

- `GET /api/v1/projects/:projectId/drive` — 현재 폴더 목록 또는 전체 검색
- `POST|PATCH|DELETE /api/v1/projects/:projectId/drive/folders/...` — 폴더 생성·수정·삭제
- `POST /api/v1/projects/:projectId/drive/files/prepare` — 최대 1GB S3 직접 업로드 준비 및 새 버전 생성
- `POST .../files/:fileId/versions/:versionId/complete` — 실제 S3 객체의 크기·형식 확인
- `GET .../files/:fileId/download` — 권한 재검증 후 5분 다운로드 URL 발급
- `GET .../files/:fileId/versions` — 파일 버전 이력
- `GET .../files/:fileId/preview` — PDF/이미지 5분 미리보기 URL
- `POST|DELETE .../files/:fileId/issues/...` — 같은 프로젝트의 이슈 연결·해제
- `PATCH|DELETE .../files/:fileId` — 이름·위치 변경 및 소프트 삭제

모든 폴더·파일 쿼리는 URL의 `projectId`를 포함합니다. 읽기 전용 역할은 변경 요청이 거부됩니다. 폴더에 그룹을 지정하면 해당 그룹 참여자만 접근하고 권한은 모든 하위 폴더와 파일에 상속됩니다. 관리자 제한 폴더와 접근할 수 없는 그룹 폴더의 존재는 목록·검색·다운로드에서 모두 숨깁니다. 변경본은 기존 객체를 덮어쓰지 않고 새 `DriveFileVersion`과 새 객체 키로 저장합니다.

### 프로젝트 문서 전자결재

웹의 **결재** 메뉴에서 공유 드라이브 문서를 선택해 기안을 저장하고, 순차 결재선을 지정해 상신할 수 있습니다. 상신 시 선택한 `DriveFileVersion`, 객체 키, 파일 크기·형식과 SHA-256 해시를 `ApprovalRevision`에 복제하여 고정하므로 공유 드라이브에 새 버전이 등록되어도 이미 상신한 결재 자료는 바뀌지 않습니다. 반려 문서는 수정 후 새 리비전으로 재상신할 수 있고 이전 결재 자료와 처리 이력은 유지됩니다.

- `GET|POST /api/v1/projects/:projectId/approvals` — 접근 가능한 결재 목록·기안 작성
- `GET|PATCH /api/v1/projects/:projectId/approvals/:documentId` — 상세 조회·기안/반려/회수 문서 수정
- `POST .../approvals/:documentId/submit` — 문서 버전·해시 고정 후 상신 또는 재상신
- `POST .../approvals/:documentId/approve|reject` — 현재 순번 지정 결재자의 승인·반려
- `POST .../approvals/:documentId/withdraw` — 기안자의 첫 승인 전 회수
- `GET .../approvals?scope=pending` — 내 결재 대기 목록
- `GET|PATCH .../approvals/notifications/...` — 결재 요청·처리 알림 조회와 읽음 처리

승인·반려는 현재 활성 순번과 지정 사용자를 서버에서 검사하며, 관리자도 대신 처리할 수 없습니다. 상태 변경, 단계 처리, 이력, 알림과 감사 로그는 같은 DB 트랜잭션에 기록됩니다. 병렬 결재와 법적 전자서명은 아직 지원하지 않습니다. 스키마 적용에는 `pnpm.cmd db:deploy`를 실행합니다.

### 실제 데이터 통합 대시보드와 검색

루트 화면은 참조 디자인에 맞춰 `프로젝트 목록 · 이슈 피드 · 3D/공유 파일/주요 일정/승인 대기`의 3열 통합 대시보드로 구성합니다. 프로젝트를 누르면 중앙 이슈 피드와 우측 프로젝트 문맥이 함께 변경됩니다. 집계 API `GET /api/v1/dashboard?projectId=<UUID>`는 사용자의 활성 프로젝트 멤버십을 검사하고 권한 없는 프로젝트 ID를 거부합니다.

**이슈 피드** 메뉴는 선택 프로젝트 아래에 `설계 관리`, `시공 관리`, `기획 관리`, `공지 사항` 그룹을 표시합니다. 각 그룹은 독립된 게시글 저장 범위를 사용하며 로컬 미리보기와 DB 시드 모두 그룹별 공지·일반 게시글·질문·이슈·의사결정 예시를 제공합니다.

상단 검색은 `GET /api/v1/search?query=검색어&limit=8`을 사용하며 프로젝트, 이슈, 일정, 공유 문서와 결재 제목을 검색합니다. API는 먼저 접근 가능한 프로젝트를 확정하고 비공개 그룹과 제한 폴더를 다시 제외하므로 권한 없는 리소스는 결과나 개수에 포함되지 않습니다. 검색어는 2~100자, 결과 제한은 유형별 최대 20개입니다.

### 프로젝트 캘린더

웹의 **일정** 메뉴는 월간·주간·목록형 보기를 제공하며 날짜를 선택해 해당 날짜의 일정만 확인할 수 있습니다. 일정에는 제목, 설명, 시작·종료, 종일 여부, 담당자·참여자, 그룹, 관련 이슈와 첨부파일, 사전 알림을 지정합니다. `토지계약`, `건축허가`, `착공`, `준공` 같은 마일스톤은 고정 코드가 아닌 프로젝트별 일반 데이터이므로 자유롭게 추가·수정·보관할 수 있습니다.

통합 대시보드의 **주요 일정** 카드와 왼쪽 **일정** 메뉴는 같은 Teamup 공유 캘린더 `https://teamup.com/ks27cco3hv5g1ove7k`를 월간 달력형으로 임베드합니다. **크게 보기** 버튼으로 화면을 확대하고 **원래 크기** 버튼이나 `Esc` 키로 복원할 수 있으며, 일정 화면에서는 Teamup 원본 링크도 열 수 있습니다. 외부 노출 범위는 Teamup 공유 링크의 권한을 따르므로 운영 전 반드시 읽기 전용 링크인지 확인해야 합니다.

- `GET|POST /api/v1/projects/:projectId/calendar` — 기간별 일정 조회·생성
- `GET|PATCH|DELETE /api/v1/projects/:projectId/calendar/:eventId` — 일정 상세·수정·보관
- `GET /api/v1/projects/:projectId/calendar/context` — 접근 가능한 그룹·이슈·프로젝트 참여자
- `GET /api/v1/projects/:projectId/calendar/reminders` — 담당자·참여자의 미확인 알림
- `PATCH .../calendar/reminders/:reminderId/read` — 알림 읽음 처리
- `POST .../calendar/:eventId/attachments/prepare` — S3 첨부 업로드 준비
- `POST .../attachments/:attachmentId/complete` — 업로드 객체 확인 및 첨부 확정
- `GET .../attachments/:attachmentId/download` — 권한 재검증 후 다운로드 URL 발급

모든 일정 조회는 프로젝트 멤버십과 그룹 접근 권한을 서버에서 다시 검사합니다. 그룹 전용 일정은 해당 그룹 참여자와 프로젝트 관리자에게만 노출되며, 관련 이슈도 같은 프로젝트·그룹에 속해야 합니다. 알림은 담당자와 참여자별로 PostgreSQL에 저장되어 재접속 후에도 확인할 수 있습니다. API가 꺼진 화면 확인 환경에서는 프로젝트별 브라우저 저장소로 자동 전환됩니다.

### 인터랙티브 3D 데모 뷰어

`/viewer`는 Three.js, React Three Fiber와 Drei를 클라이언트에서만 지연 로드합니다. 외부 모델 파일을 다운로드하지 않고 코드로 대지, 저층부, 상층부와 옥상 객체를 생성하며 회전·확대/축소·화면 이동, 전체 보기, 시점 초기화, 객체 선택·강조, 층별 표시, 데모 속성과 객체 관련 이슈를 제공합니다.

화면에는 `3D 데모 모델 — 실제 BIM 연동 전`을 명시합니다. 실제 IFC 파싱·업로드 및 DWG 표시는 지원하지 않으며 `/cad`는 연동 예정 안내만 표시합니다. 모델 공급 계층은 `ViewerAdapter` 인터페이스로 분리되어 있습니다. 샘플 건물은 PROJECT HUB에서 직접 생성한 기하 모델이므로 별도의 외부 모델 저작권이나 다운로드 의존성이 없습니다. Three.js 계열 라이브러리는 각 패키지의 MIT 라이선스를 따릅니다.

## 연결 확인

API 생존 상태:

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health
```

PostgreSQL, Redis, S3 준비 상태:

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health/ready
```

정상 응답 예시:

```json
{
  "service": "PROJECT HUB API",
  "status": "정상",
  "version": "0.1.0",
  "timestamp": "2026-10-28T00:00:00.000Z"
}
```

준비 상태 API는 기반 서비스 중 하나라도 연결되지 않으면 HTTP 503을 반환하고 각 서비스 상태를 한국어로 제공합니다.

## 품질 검증

전체 검증:

```powershell
pnpm.cmd check
```

개별 명령:

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

API HTTP E2E 테스트:

```powershell
pnpm.cmd --filter @project-hub/api test:e2e
```

브라우저 E2E와 출시 전체 게이트:

```powershell
pnpm.cmd exec playwright install chromium
pnpm.cmd test:e2e:web
pnpm.cmd check:launch
pnpm.cmd check:security
```

성능 기준선은 API 실행 후 `pnpm.cmd test:performance`로 측정합니다. 기본값은 동시 요청 20개, 경로당 500회, p95 500ms이며 `PERF_BASE_URL`, `PERF_PATHS`, `PERF_REQUESTS`, `PERF_CONCURRENCY`, `PERF_P95_LIMIT_MS`, `PERF_BEARER_TOKEN`으로 변경할 수 있습니다.

기반 서비스 연결을 포함한 수동 스모크 테스트는 Docker 서비스를 실행한 뒤 `/health/ready`와 웹 연결 카드를 확인합니다.

## 프로젝트 구조

```text
project-hub/
├─ apps/
│  ├─ web/                    # Next.js 한국어 UI
│  └─ api/                    # NestJS API, Prisma 스키마·마이그레이션
├─ packages/
│  └─ contracts/              # 웹/API 공용 응답 계약
├─ docs/                      # 제품·아키텍처·권한·로드맵·운영·출시 문서
├─ e2e/                       # Playwright 브라우저 출시 회귀
├─ scripts/                   # 빌드, 성능, 백업·복구 자동화
├─ compose.yaml               # PostgreSQL, Redis, RustFS(S3 호환)
├─ .env.example
├─ pnpm-workspace.yaml
└─ AGENTS.md
```

## 주요 명령

| 명령              | 설명                                      |
| ----------------- | ----------------------------------------- |
| `pnpm dev`        | 웹과 API 동시 개발 실행                   |
| `pnpm infra:up`   | 로컬 기반 서비스 실행 및 준비 대기        |
| `pnpm infra:down` | 로컬 기반 서비스 중지                     |
| `pnpm infra:logs` | 컨테이너 로그 확인                        |
| `pnpm db:migrate` | 개발용 마이그레이션 생성·적용             |
| `pnpm db:deploy`  | 기존 마이그레이션 적용                    |
| `pnpm db:seed`    | 개발용 기본 데이터 생성                   |
| `pnpm lint`       | 전체 워크스페이스 ESLint 검사             |
| `pnpm typecheck`  | 전체 TypeScript 검사                      |
| `pnpm test`       | 전체 단위·컴포넌트 테스트                 |
| `pnpm build`      | 공통 계약, API, 웹 프로덕션 빌드          |
| `pnpm check`      | lint → typecheck → test → build 순차 실행 |
| `pnpm test:e2e:web` | Playwright 데스크톱·모바일 E2E          |
| `pnpm check:launch` | 전체 검사 후 브라우저 E2E 실행           |
| `pnpm check:security` | 높음 이상 의존성 취약점 감사           |
| `pnpm test:performance` | 핵심 API p95 성능 기준선 측정         |

## 환경변수

| 변수                                    | 설명                                                                 |
| --------------------------------------- | -------------------------------------------------------------------- |
| `WEB_PORT`, `API_PORT`                  | 웹/API 포트                                                          |
| `WEB_ORIGIN`                            | API CORS에서 허용할 웹 주소                                          |
| `NEXT_PUBLIC_API_BASE_URL`              | 브라우저가 호출할 API 프록시 경로                                    |
| `NEXT_PUBLIC_API_SOCKET_URL`            | 브라우저가 연결할 Socket.IO API 주소                                 |
| `API_INTERNAL_URL`                      | Next.js 프록시가 연결할 NestJS 주소                                  |
| `AUTH_TOKEN_SECRET`                     | API Bearer 토큰 HMAC 서명 비밀. 운영 환경에서 충분히 긴 임의 값 사용 |
| `ENABLE_DEV_AUTH`                       | 로컬 시드 사용자 세션 활성화. 운영 환경에서는 반드시 비활성화        |
| `METRICS_TOKEN`                         | 보호된 운영 메트릭 엔드포인트 접근 토큰                              |
| `DATABASE_URL`                          | PostgreSQL 연결 문자열                                               |
| `REDIS_URL`                             | Redis/BullMQ 연결 문자열                                             |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` | S3 호환 저장소 설정                                                  |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY`        | S3 로컬 접근 자격증명                                                |
| `S3_FORCE_PATH_STYLE`                   | S3 호환 저장소 경로 방식 사용 여부                                   |

## 출시·운영 문서

- [출시 준비 증적과 MVP 수용 기준](docs/LAUNCH_READINESS.md)
- [운영 런북](docs/OPERATIONS.md)
- [배포와 롤백](docs/DEPLOYMENT.md)
- [장애 대응](docs/INCIDENT_RESPONSE.md)
- [데이터 보존·삭제와 백업 복구](docs/DATA_RETENTION.md)
- [Google Drive 및 Firebase 검증](docs/GOOGLE_DRIVE_FIREBASE.md)
- [스테이징 UAT](docs/UAT.md)

## 종료와 데이터 초기화

서비스만 중지하면 볼륨 데이터는 유지됩니다.

```powershell
pnpm.cmd infra:down
```

볼륨 삭제는 PostgreSQL과 RustFS의 로컬 데이터를 모두 제거하는 파괴적 작업이므로 필요한 경우에만 대상 데이터를 확인한 뒤 직접 수행하세요.

## 문제 해결

### Docker 명령을 찾을 수 없음

Docker Desktop을 설치하고 새 터미널에서 `docker --version`과 `docker compose version`을 확인합니다. Docker가 없어도 `lint`, `typecheck`, 단위 테스트와 빌드는 실행할 수 있지만 DB 마이그레이션 적용과 실제 기반 서비스 준비 상태 검증은 할 수 없습니다.

### 웹에서 API 연결 실패 표시

1. API가 4000번 포트에서 실행 중인지 확인합니다.
2. `Invoke-RestMethod http://localhost:4000/api/v1/health`를 실행합니다.
3. `.env`의 `API_INTERNAL_URL`과 `NEXT_PUBLIC_API_BASE_URL`을 확인합니다.
4. 환경변수를 변경했다면 웹 개발 서버를 다시 시작합니다.

### API가 환경변수 오류로 종료됨

루트에 `.env`가 있는지 확인하고 `.env.example`에 정의된 필수 항목을 빠짐없이 설정합니다. API는 누락된 키 이름을 한국어 오류로 안내합니다.

## 개발 규칙

- 모든 사용자 UI와 오류 메시지는 한국어로 작성합니다.
- 다음 로드맵 단계는 현재 단계의 테스트가 통과한 뒤 시작합니다.
- 권한은 UI가 아니라 API에서 기본 거부 방식으로 검증합니다.
- 실제 비밀, 사용자 파일, 로컬 DB 볼륨은 커밋하지 않습니다.
- 상세 기준은 [AGENTS.md](./AGENTS.md)와 [docs](./docs)를 따릅니다.
