# PROJECT HUB 시스템 아키텍처

## 1. 목적과 원칙

이 문서는 PROJECT HUB MVP의 기술 구조, 모듈 경계, 데이터 흐름과 운영 기준을 정의한다.

핵심 원칙은 다음과 같다.

1. Next.js와 NestJS를 분리하여 UI와 도메인 API의 책임을 명확히 한다.
2. PostgreSQL을 업무 데이터의 단일 진실 공급원으로 사용한다.
3. Redis는 캐시·큐·단기 상태에만 사용하며 원본 업무 데이터를 두지 않는다.
4. 파일 본문은 S3 호환 저장소에, 메타데이터와 권한은 PostgreSQL에 저장한다.
5. 모든 프로젝트 데이터 접근은 프로젝트 멤버십과 권한 검사를 거친다.
6. 초기에는 모듈형 모놀리스로 구현하고 실제 부하와 조직 경계가 확인된 뒤 분리한다.
7. 각 개발 단계는 자동화 테스트를 통과한 뒤 다음 단계로 진행한다.

## 2. 기본 기술 스택

| 영역 | 기술 | 용도 |
| --- | --- | --- |
| 웹 | Next.js, React, TypeScript | 한국어 사용자 UI, 서버 렌더링, BFF가 아닌 API 소비 |
| API | NestJS, TypeScript | REST API, 인증·인가, 도메인 로직 |
| 데이터베이스 | PostgreSQL | 트랜잭션 업무 데이터, 검색용 메타데이터 |
| 캐시·큐 | Redis | 세션/토큰 보조, 속도 제한, 작업 큐, 단기 캐시 |
| 객체 저장소 | S3 호환 저장소 | 파일, 사진, 썸네일, 샘플 3D 모델 |
| ORM | Prisma 우선 | 스키마, 마이그레이션, 타입 안전 데이터 접근 |
| 비동기 작업 | BullMQ 우선 | 썸네일, 알림, 임시 업로드 정리 |
| 3D | Three.js, React Three Fiber, Drei | 클라이언트 전용 자체 생성 데모 모델 표시, `ViewerAdapter`로 향후 IFC 공급자 분리 |
| 테스트 | Vitest/Jest, Supertest, Playwright | 단위·통합·E2E 테스트 |
| API 계약 | OpenAPI | NestJS API 문서와 클라이언트 타입 생성 기반 |

세부 라이브러리는 구현 단계에서 결정하되 같은 목적의 라이브러리를 중복 도입하지 않는다.

## 3. 저장소 구조

pnpm workspace 기반 모노레포를 기본안으로 한다.

```text
project-hub/
├─ apps/
│  ├─ web/                 # Next.js
│  └─ api/                 # NestJS
├─ packages/
│  ├─ ui/                  # 공통 UI 컴포넌트와 디자인 토큰
│  ├─ contracts/           # API 타입, 스키마, 공유 상수
│  ├─ config-eslint/       # 공통 정적 분석 설정
│  └─ config-typescript/   # 공통 TypeScript 설정
├─ infra/
│  ├─ docker/              # 로컬 개발용 구성
│  └─ migrations/          # 인프라 변경 자료(필요 시)
├─ docs/
├─ .env.example
├─ compose.yaml
├─ pnpm-workspace.yaml
└─ AGENTS.md
```

`packages/contracts`에는 공개 계약만 두며 NestJS 내부 엔티티나 Prisma 모델을 웹에 직접 노출하지 않는다.

## 4. 논리 구성

```text
[브라우저]
    │ HTTPS / JSON
    ▼
[Next.js Web] ───────────────┐
    │ REST API               │ S3 사전 서명 업로드/다운로드
    ▼                        ▼
[NestJS API] ───────────► [S3 호환 저장소]
    │       │
    │       └────────────► [Redis / BullMQ] ──► [Worker]
    ▼
[PostgreSQL]
```

- 브라우저는 인증된 API 요청을 NestJS로 보낸다.
- 업로드는 API에서 권한과 메타데이터를 검증한 뒤 발급한 사전 서명 URL로 수행한다.
- Next.js 서버가 필요 시 초기 화면 데이터를 가져올 수 있으나 권한 판단은 항상 API가 최종 책임을 가진다.
- 비동기 작업은 API가 큐에 넣고 워커가 처리한다.

## 5. NestJS 모듈 경계

| 모듈 | 책임 |
| --- | --- |
| AuthModule | 로그인, 토큰/세션, 비밀번호, 인증 가드 |
| UsersModule | 사용자 프로필과 계정 상태 |
| OrganizationsModule | 조직, 조직 멤버십, 조직 역할 |
| CollaborationModule | 프로젝트, 다회사 프로젝트 멤버십, 협업 그룹, 역할 기반 접근제어 |
| IssuesModule | 이슈, 댓글, 상태 변경, 멘션 |
| FeedModule | 그룹별 블로그형 게시글, 댓글·답글, 태그·검색, 첨부 업로드 확정 |
| RealtimeModule | WebSocket 인증·그룹 룸, Redis Pub/Sub, 알림, 재접속 이벤트 동기화 |
| DriveModule | 프로젝트 폴더 트리, 그룹 ACL 상속, 파일 메타데이터·버전, 이슈 연결, S3 서명·미리보기 URL |
| CalendarModule | 월간·주간·목록 일정, 프로젝트별 사용자 정의 마일스톤, 담당자·참여자 알림, 이슈·S3 첨부 연결, 그룹 ACL |
| ViewerModule | 샘플 모델 메타데이터와 접근 URL |
| ApprovalsModule | 결재 문서, 결재선, 승인·반려 상태 머신 |
| NotificationsModule | 앱 내 알림, 이메일 작업 요청 |
| DashboardModule | 접근 가능한 프로젝트·그룹·폴더 기반 집계 읽기 모델과 권한 적용 통합 검색 |
| AuditModule | 변경 불가능한 감사 이벤트 기록·조회 |
| JobsModule | BullMQ 생산자·소비자와 예약 정리 작업 |

모듈 간 호출은 공개 서비스 또는 도메인 이벤트를 사용한다. 다른 모듈의 테이블을 임의로 직접 수정하지 않는다.

## 6. Next.js 애플리케이션 구조

App Router를 사용하며 주요 경로는 다음과 같이 구성한다.

```text
/로그인
/초대/[token]
/대시보드
/프로젝트
/프로젝트/[projectId]
/프로젝트/[projectId]/이슈
/프로젝트/[projectId]/파일
/프로젝트/[projectId]/캘린더
/프로젝트/[projectId]/3d-뷰어
/프로젝트/[projectId]/결재
/프로젝트/[projectId]/설정/멤버
/내-알림
/내-설정
```

실제 URL 슬러그는 유지보수와 호환성을 위해 영문을 사용할 수 있으나 사용자에게 표시되는 내비게이션과 문구는 전부 한국어로 작성한다.

- 서버 컴포넌트는 초기 데이터와 읽기 중심 화면에 사용한다.
- 클라이언트 컴포넌트는 편집기, 업로드, 캘린더, 3D 뷰어 등 상호작용이 필요한 영역에 한정한다.
- 서버 상태는 전용 데이터 패칭 계층에서 관리하고 권한 없는 캐시 공유를 방지한다.
- 폼 검증 규칙은 API 계약과 일치시킨다.

## 7. 인증과 세션

MVP 기본안은 짧은 수명의 액세스 토큰과 회전 가능한 리프레시 토큰이다.

- 브라우저 토큰은 `HttpOnly`, `Secure`, 적절한 `SameSite` 쿠키에 둔다.
- 리프레시 토큰 원문은 저장하지 않고 해시와 세션 메타데이터만 저장한다.
- 토큰 회전 시 이전 토큰 재사용을 감지하면 해당 세션 계열을 폐기한다.
- 로그인 실패에는 IP와 계정 기준 속도 제한을 적용한다.
- 비밀번호는 Argon2id 등 검증된 알고리즘으로 해시한다.
- CSRF 위협 모델을 확정하고 상태 변경 요청에 Origin 검증 또는 CSRF 토큰을 적용한다.
- 계정 정지, 프로젝트 멤버 비활성화는 다음 API 요청부터 즉시 반영한다.

인증은 “누구인가”만 증명하며, 각 리소스 접근은 별도 인가 정책으로 판단한다.

## 8. 인가 모델

인가 판단 입력은 다음과 같다.

```text
사용자 계정 상태
  + 조직 멤버십/조직 역할
  + 프로젝트 멤버십/프로젝트 역할
  + 리소스 소유·담당 관계
  + 제한 폴더 등 명시적 예외
  + 리소스 상태(결재 중, 삭제됨 등)
= 허용 또는 거부
```

- 기본 거부(deny by default)를 적용한다.
- API 컨트롤러 진입 시 인증을, 서비스 계층에서 프로젝트와 리소스 범위 인가를 검증한다.
- 조회 쿼리 자체에 `project_id` 범위를 포함해 다른 프로젝트 데이터의 노출을 차단한다.
- 프런트엔드는 서버가 내려준 권한 집합으로 UI를 조정하지만 서버 검사를 대체하지 않는다.
- 상세 역할과 행위 매트릭스는 [PERMISSIONS.md](./PERMISSIONS.md)를 따른다.

## 9. 데이터 모델 초안

모든 기본 키는 UUID를 사용하고, 업무 테이블은 `created_at`, `updated_at`을 가진다. 소프트 삭제 대상은 `deleted_at`, 변경 주체가 중요한 데이터는 `created_by`, `updated_by`를 가진다.

### 9.1 조직과 프로젝트

```text
User 1─N OrganizationMembership N─1 Organization
User 1─N ProjectMembership N─1 Project N─1 Organization
Organization 1─N ProjectMembership
Project 1─N CollaborationGroup 1─N GroupMembership N─1 ProjectMembership
Project 1─N Invitation
```

- `ProjectMembership`은 프로젝트별 역할, 활성 상태와 참여자의 소속 회사를 저장한다.
- 조직이 다른 외부 참여자도 프로젝트 멤버가 될 수 있다.
- `GroupMembership`은 반드시 같은 프로젝트의 `ProjectMembership`을 참조하며 그룹별 관리자·멤버·읽기 전용 권한을 저장한다.
- 모든 프로젝트 종속 테이블은 `project_id`를 직접 가져 범위 검증과 인덱싱을 단순화한다.

### 9.2 이슈와 협업

```text
Project 1─N Issue 1─N Comment
Issue N─1 User(작성자)
Issue N─0..1 User(담당자)
Issue/Comment 1─N Attachment N─1 FileVersion
```

이슈 상태 변경은 활동 레코드와 감사 이벤트를 함께 생성한다. 멘션은 정제된 사용자 ID로 저장하고 알림 작업을 발생시킨다.

### 9.3 파일

```text
Project 1─N Folder (parent_id 자기 참조)
Folder 1─N File 1─N FileVersion
FileVersion 1─N Attachment
Folder/File 1─N ResourceAccessOverride
```

- 파일 논리 개체와 실제 바이너리 버전을 분리한다.
- 객체 키 예시: `organizations/{orgId}/projects/{projectId}/files/{fileId}/versions/{versionId}`
- DB 트랜잭션과 객체 업로드는 하나의 원자 트랜잭션이 아니므로 `PENDING_UPLOAD → AVAILABLE → QUARANTINED/DELETED` 상태를 둔다.
- 체크섬, 크기, MIME, 원본 파일명, 객체 키, 업로더를 기록한다.
- 폴더 순환 참조는 서비스와 DB 제약 가능한 범위에서 차단한다.

### 9.4 결재

```text
ApprovalDocument 1─N ApprovalRevision 1─N ApprovalStep
ApprovalDocument 1─N ApprovalAction
ApprovalDocument 1─N ApprovalNotification
```

- 초안 결재선은 `ApprovalRouteMember`로 관리하고 상신 시 각 리비전의 `ApprovalStep`으로 복제한다.
- 리비전에는 제목·본문과 `DriveFileVersion`, 객체 키, 파일명, 크기, MIME, SHA-256 스냅샷을 저장한다.
- 단계에는 순번, 결재자, 상태, 처리시각을 두며 활성 순번은 항상 하나만 허용한다.
- 승인·반려는 문서 행을 잠그거나 낙관적 버전 필드를 사용해 중복 처리를 방지한다.
- 상태 변경은 단일 DB 트랜잭션에서 문서, 단계, 이력, 알림, 감사 로그를 갱신한다.

### 9.5 감사 로그

감사 로그에는 `actor_id`, `organization_id`, `project_id`, `action`, `resource_type`, `resource_id`, `request_id`, `occurred_at`, 최소한의 변경 요약을 저장한다. 비밀번호, 토큰, 파일 본문, 민감한 결재 본문은 기록하지 않는다.

## 10. API 설계 원칙

- 기본 경로는 `/api/v1`이다.
- REST 자원 중심 URL과 표준 HTTP 상태 코드를 사용한다.
- 오류 응답은 `code`, `message`, `details`, `requestId` 구조로 통일하고 `message`는 한국어 UI에서 안전하게 표시 가능한 문구로 매핑한다.
- 목록에는 페이지네이션, 정렬, 허용 목록 기반 필터를 적용한다.
- 입력 DTO는 화이트리스트 검증을 사용하며 알 수 없는 필드는 거부한다.
- 결재 처리, 업로드 확정 등 재시도 가능 요청은 멱등 키 또는 상태 조건을 사용한다.
- OpenAPI 문서를 CI에서 생성·검증하고 웹 타입 생성의 기준으로 사용한다.

대표 API 예시는 다음과 같다.

```text
POST   /api/v1/auth/login
GET    /api/v1/projects
POST   /api/v1/projects/:projectId/invitations
GET    /api/v1/projects/:projectId/issues
POST   /api/v1/projects/:projectId/issues
POST   /api/v1/projects/:projectId/uploads/presign
POST   /api/v1/projects/:projectId/uploads/:uploadId/complete
GET    /api/v1/projects/:projectId/calendar-events
POST   /api/v1/projects/:projectId/approvals
POST   /api/v1/projects/:projectId/approvals/:id/submit
POST   /api/v1/projects/:projectId/approvals/:id/approve
```

## 11. 파일 업로드와 다운로드 흐름

### 11.1 업로드

1. 클라이언트가 파일명, 크기, MIME, 연결 대상 정보를 API에 전달한다.
2. API가 프로젝트 권한, 확장자, 크기, 저장 용량을 검증한다.
3. API가 `PENDING_UPLOAD` 레코드와 짧은 유효기간의 사전 서명 URL을 생성한다.
4. 클라이언트가 객체 저장소에 직접 업로드한다.
5. 클라이언트가 업로드 완료 API를 호출한다.
6. API 또는 워커가 객체 존재, 크기, 체크섬을 확인하고 `AVAILABLE`로 변경한다.
7. 이미지이면 썸네일 생성 작업을 큐에 넣는다.

### 11.2 다운로드

1. 클라이언트가 파일 버전 다운로드를 요청한다.
2. API가 멤버십과 폴더 예외 권한을 검사한다.
3. 짧은 유효기간의 다운로드 URL 또는 프록시 정책을 반환한다.
4. 접근 이벤트를 감사 정책에 따라 기록한다.

운영 전 악성코드 검사 도입 지점을 업로드 완료와 공개 가능 상태 사이에 둔다.

## 12. Redis와 비동기 처리

Redis 사용 범위:

- 로그인·민감 API 속도 제한
- BullMQ 작업 큐
- 짧은 수명의 집계 캐시
- 중복 작업 방지용 잠금과 멱등 키
- 필요 시 세션 폐기 목록

주요 큐:

- `file-thumbnail`: 이미지 썸네일 생성
- `notification`: 앱 알림과 이메일 발송
- `upload-cleanup`: 만료된 임시 업로드 정리
- `audit-export`: 추후 관리자용 감사 내보내기

작업은 재시도되어도 같은 결과를 내도록 설계하고, 최대 재시도 후 실패 큐와 경보를 제공한다.

## 13. 캐시와 일관성

- 권한 판단 결과는 장시간 캐시하지 않는다.
- 대시보드 집계는 짧은 TTL을 허용하고 이슈·일정·결재 변경 시 관련 키를 무효화한다.
- 프로젝트 멤버십 변경 시 사용자별 프로젝트 목록과 권한 캐시를 즉시 제거한다.
- 캐시 장애 시 권한과 핵심 업무는 PostgreSQL을 기준으로 계속 동작해야 한다.

## 14. 보안 설계

- OWASP ASVS의 인증·세션·접근제어·입력검증 항목을 우선 점검한다.
- CORS는 허용된 웹 출처로 제한한다.
- 보안 헤더와 Content Security Policy를 적용한다.
- 리치 텍스트는 서버에서 정제하며 위험한 URL 스킴을 차단한다.
- 객체 저장소 버킷은 비공개로 유지하고 공개 ACL을 사용하지 않는다.
- 파일 MIME은 클라이언트 값만 신뢰하지 않고 서버 또는 워커에서 확인한다.
- 개인정보와 비밀은 구조화 로그에서 마스킹한다.
- 관리자 작업, 멤버십 변경, 제한 폴더 접근, 결재 처리는 감사 로그를 남긴다.

## 15. 로컬 개발 환경

로컬에서는 Docker Compose로 다음 서비스를 실행하는 구성을 목표로 한다.

- PostgreSQL
- Redis
- MinIO(S3 호환)
- 선택적 메일 테스트 서버

웹과 API는 호스트에서 개발 서버로 실행할 수 있게 한다. `.env.example`에는 키 이름과 안전한 예시만 두고 실제 비밀은 커밋하지 않는다. 스키마 마이그레이션과 시드 데이터는 명시적 명령으로 실행한다.

샘플 데이터는 최소한 다음을 포함한다.

- 시행사 관리자 1명, PM 1명, 외부 참여자 2명
- 진행 중 프로젝트 1개
- 이슈, 댓글, 일정, 폴더와 파일 메타데이터
- 결재 대기 문서 1개
- 라이선스가 확인된 샘플 GLB 모델 1개

## 16. 테스트 전략과 단계 게이트

| 계층 | 대상 | 도구 예시 |
| --- | --- | --- |
| 단위 | 권한 정책, 상태 머신, 검증, 유틸리티 | Vitest/Jest |
| 통합 | PostgreSQL 저장소, API, Redis 큐, S3 연동 | Jest, Supertest, Testcontainers 또는 Compose |
| 계약 | OpenAPI 스키마와 웹 클라이언트 타입 | OpenAPI 검증 도구 |
| 컴포넌트 | 폼, 목록, 권한별 UI, 오류 상태 | Testing Library |
| E2E | 핵심 사용자 여정과 권한 우회 방지 | Playwright |

각 로드맵 단계는 다음 조건을 모두 만족해야 완료된다.

1. 해당 기능의 수용 기준이 문서화되어 있다.
2. 단위·통합 테스트가 통과한다.
3. 핵심 흐름의 E2E 테스트가 통과한다.
4. 권한 허용·거부 테스트가 모두 존재하고 통과한다.
5. 타입 검사와 빌드가 성공한다.
6. 중요한 오류·빈 상태·로딩 상태를 한국어 UI로 확인한다.
7. 문서와 마이그레이션이 코드와 일치한다.

실패한 테스트를 건너뛰거나 비활성화하여 다음 단계로 진행하지 않는다.

## 17. 배포 구조 초안

초기 운영은 다음의 독립 배포 단위를 권장한다.

- Next.js 웹 서비스
- NestJS API 서비스
- NestJS/BullMQ 워커
- 관리형 PostgreSQL
- 관리형 Redis
- S3 호환 객체 저장소

CI/CD 기본 순서:

```text
의존성 고정 설치
→ 정적 검사와 타입 검사
→ 단위 테스트
→ 통합 테스트
→ 웹/API 빌드
→ 마이그레이션 호환성 점검
→ 이미지 생성 및 보안 점검
→ 스테이징 배포
→ E2E/스모크 테스트
→ 승인된 운영 배포
```

DB 마이그레이션은 하위 호환 가능한 확장-전환-정리 방식으로 수행하고 애플리케이션 배포와 롤백 순서를 문서화한다.

## 18. 아키텍처 결정 기록 대상

아래 결정은 구현 시 ADR로 남긴다.

- 인증 토큰 방식과 CSRF 대응
- Prisma 채택과 마이그레이션 운영 방식
- 리치 텍스트 저장 형식
- 폴더 경로 모델(인접 리스트, ltree 등)
- 썸네일·악성코드 검사 처리 방식
- API 클라이언트 타입 생성 방식
- 3D 렌더러와 샘플 모델 라이선스
- 운영 클라우드와 S3 호환 제품

