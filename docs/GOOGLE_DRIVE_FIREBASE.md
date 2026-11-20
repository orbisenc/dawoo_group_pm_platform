# Firebase Hosting 및 Google Drive 연동

## 배포 구조

- Firebase Hosting은 `apps/web/out`의 Next.js 정적 내보내기 결과를 배포한다.
- 로컬 개발에서는 기존 `/backend` 재작성을 통해 NestJS API를 사용한다.
- Firebase 정적 배포에서는 API가 필요한 기존 기능이 브라우저 로컬 대체 모드로 동작한다.
- `build:firebase`는 비용 없는 기능 확인을 위해 `NEXT_PUBLIC_ENABLE_TEST_AUTH=true`를 설정한다. 이 모드는 서버 인증이나 실제 권한 부여가 아니며 데이터는 해당 브라우저에만 저장된다.
- Google Drive 기능은 브라우저에서 Google Drive API를 직접 호출한다.

정적 데모에는 운영 계정, 개인정보, 계약서나 실제 사업 파일을 입력하지 않는다. API 배포를 시작할 때는 테스트 인증 플래그를 제거하고 서버 인증·권한 검사를 사용해야 한다.

## Google Cloud 설정

1. Firebase 프로젝트와 연결된 Google Cloud 프로젝트에서 **Google Drive API**를 사용 설정한다.
2. Google Auth Platform에서 앱 이름, 지원 이메일, 대상 사용자를 설정한다.
3. **웹 애플리케이션** 유형의 OAuth 클라이언트를 만든다.
4. 승인된 JavaScript 원본에 아래 주소를 추가한다.
   - `http://localhost:3004`
   - `https://dawoo-group-pm-platform.web.app`
   - `https://dawoo-group-pm-platform.firebaseapp.com`
5. OAuth 클라이언트 ID를 루트 `.env`의 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`에 설정한다.

클라이언트 보안 비밀은 웹 앱이나 저장소에 추가하지 않는다. OAuth 클라이언트 ID는 공개 식별자이며, 액세스 토큰은 React 상태의 브라우저 메모리에만 보관한다.

## 사용자 동작

1. 공유 드라이브 화면에서 `Google Drive`를 선택한다.
2. 사용자가 Google 계정 연결과 `drive.file` 권한을 승인한다.
3. 앱은 사용자의 내 드라이브에 `DAWOO GROUP PROJECT HUB` 폴더를 찾거나 생성한다.
4. 사용자는 해당 폴더에서 검색, 폴더 생성, 파일 업로드, 이름 변경, 열기, 휴지통 이동을 수행한다.

`drive.file` 범위를 사용하므로 앱이 직접 만들거나 사용자가 앱에 허용한 파일만 접근한다. Google Drive 항목은 PROJECT HUB의 프로젝트 역할 권한을 자동으로 상속하지 않으므로, 제한 문서와 결재 원본은 기존 비공개 S3 호환 저장소를 계속 사용한다.

## 빌드 및 배포

```powershell
pnpm.cmd build:firebase
npx.cmd --yes firebase-tools@latest deploy --only hosting --project dawoo-group-pm-platform
```

Firebase 로그인 상태는 다음 명령으로 확인한다.

```powershell
npx.cmd --yes firebase-tools@latest login:list
npx.cmd --yes firebase-tools@latest projects:list
```

## 환경변수

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Drive 연동 시 필수 | Google OAuth 웹 클라이언트 ID |
| `FIREBASE_STATIC_EXPORT` | 빌드 스크립트가 자동 설정 | Next.js 정적 내보내기 활성화 |
| `NEXT_PUBLIC_ENABLE_TEST_AUTH` | 정적 데모에서만 사용 | 브라우저 로컬 테스트 로그인 활성화. 운영에서는 `false` |

## 출시 전 실제 Google 테스트 계정 검증

운영 계정이나 운영 문서를 사용하지 않는다. Google Workspace 관리자가 만든 전용 테스트 사용자 2명과 테스트 공유 드라이브를 사용하며, 테스트 종료 후 권한과 파일을 제거한다.

준비사항:

1. OAuth 동의 화면의 앱 이름, 지원 이메일, 개인정보 처리방침·이용약관 URL을 등록한다.
2. 최소 범위인 `drive.file`과 실제 사용 기능의 적합성을 검토한다.
3. 테스트 상태라면 테스트 사용자를 등록하고, 외부 출시라면 Google OAuth 앱 검증 상태와 사용자 제한을 확인한다.
4. 승인된 JavaScript 원본에 스테이징·운영 HTTPS 원본만 정확히 등록한다. 와일드카드는 사용하지 않는다.
5. 자동 공유 드라이브 초대용 서비스 계정을 테스트 공유 드라이브의 관리자로 추가하고 관련 환경변수를 비밀 저장소에서 주입한다.

| ID | 검증 | 기대 결과 |
| --- | --- | --- |
| G-01 | 최초 연결과 동의 화면 | 앱·지원 이메일·요청 범위가 정확하고 연결 성공 |
| G-02 | 연결 취소 | 한국어 오류와 재시도 방법 안내 |
| G-03 | 폴더 생성, 다중 업로드, 이름 변경·이동·휴지통 | 새로고침 후 Google Drive와 동일한 결과 |
| G-04 | PDF/이미지 미리보기와 다운로드 | 허용된 계정만 정상 접근 |
| G-05 | 액세스 토큰 만료 후 작업 | 비밀번호를 요구하지 않고 재연결 안내 |
| G-06 | 브라우저 재시작 후 재연결 | 명시적 계정 선택·동의 정책 준수 |
| G-07 | Google 권한 철회 후 작업 | 데이터 노출 없이 연결 해제 상태와 재연결 안내 |
| G-08 | 승인된 Gmail 신규 회원 | `다우그룹_공유 드라이브`에 `writer` 권한 초대, 중복 초대 없음 |
| G-09 | 비 Gmail·미승인 회원 | 자동 초대 작업을 만들지 않음 |
| G-10 | 서비스 계정/Drive API 장애 | 재시도 후 최종 실패가 관찰되고 토큰 미노출 |

각 결과에 테스트 계정 별칭, 실행 시각, OAuth 앱 상태, 브라우저, 성공/실패와 스크린샷 또는 Google 감사 로그 식별자를 남긴다. 실제 이메일 주소, 액세스 토큰, 서비스 계정 키는 증적에 기록하지 않는다.
