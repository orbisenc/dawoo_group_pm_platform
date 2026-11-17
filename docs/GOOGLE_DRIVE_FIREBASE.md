# Firebase Hosting 및 Google Drive 연동

## 배포 구조

- Firebase Hosting은 `apps/web/out`의 Next.js 정적 내보내기 결과를 배포한다.
- 로컬 개발에서는 기존 `/backend` 재작성을 통해 NestJS API를 사용한다.
- Firebase 정적 배포에서는 API가 필요한 기존 기능이 브라우저 로컬 대체 모드로 동작한다.
- Google Drive 기능은 브라우저에서 Google Drive API를 직접 호출한다.

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
