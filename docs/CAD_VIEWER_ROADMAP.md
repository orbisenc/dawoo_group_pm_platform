# CAD Viewer for Drive 2D 도면 뷰어 로드맵

## 목표와 경계

PROJECT HUB의 CAD 탭 왼쪽에 CADViewer 전용 창 실행 영역을 두고, 오른쪽 Google Drive 탐색기에서 선택한 DWG/DXF 파일을 Google Drive Open-with 상태로 이름이 고정된 `cadviewer.co` 최상위 창에 연결한다. Google OAuth가 외부 iframe에서 차단되는 문제를 피하기 위해 CADViewer를 임베드하지 않는다. PROJECT HUB API는 CAD 원본, Google OAuth 토큰, CAD Viewer 계정 토큰을 외부 뷰어에 중계하거나 저장하지 않는다. CAD 경로에는 Autodesk APS를 사용하지 않는다.

## 단계별 상태

| 단계 | 범위 | 상태 | 완료 증적 |
| --- | --- | --- | --- |
| CAD-1 전용 창 연결 | 고정 좌우 레이아웃, 재사용 가능한 `cadviewer.co/viewer` 최상위 창, 한국어 상태 UI | 완료 | 전용 창 이름과 실행 동작 컴포넌트 테스트 |
| CAD-2 Drive 연결 | 내 드라이브·공유 드라이브 탐색, DWG/DXF 필터, 클릭·드래그 앤 드롭 | 완료 | Open-with `state` 생성 단위 테스트 |
| CAD-3 복원 | 프로젝트별 12시간 복원, 최근 도면 5개 | 완료 | 세션 저장소 테스트 |
| CAD-4 실제 계정 UAT | CAD Viewer 로그인, 실제 DWG/DXF 열기, 공유 드라이브 권한 검증 | 진행 중 | 승인된 Google 테스트 계정과 실제 도면 확인 필요 |
| CAD-5 운영 검토 | 외부 서비스 약관·데이터 처리, Open-with 계약, 팝업 정책, 장애 대체 경로 | 보류 | 운영 배포 결정 시 별도 보안·조달 검토 |

## 수용 기준

- CAD 탭의 왼쪽 영역에서 하나의 CADViewer 전용 창을 열고 이후 도면에서도 같은 창을 재사용해야 한다.
- 오른쪽 Google Drive의 DWG/DXF 파일을 클릭하거나 왼쪽으로 끌어 놓으면 해당 파일 ID가 Open-with 상태로 전달되어야 한다.
- Google Drive 폴더와 지원하지 않는 형식은 외부 뷰어 열기 대상으로 처리하지 않는다.
- 원본 파일과 OAuth 토큰은 PROJECT HUB API를 통과하지 않는다.
- 최근 도면은 프로젝트별 최대 5개, 최대 12시간만 유지한다.
- 로컬 파일은 브라우저 교차 출처 보안상 PROJECT HUB가 자동 주입하지 않으며, 사용자는 CADViewer 창의 `From computer` 기능을 사용한다.
- Google 인증과 렌더링은 최상위 CADViewer 창에서 수행하여 iframe OAuth 403 오류가 발생하지 않아야 한다.
- 외부 서비스 로그인, 파일 처리, 요금제와 장애는 CAD Viewer for Drive 정책과 상태에 의존한다.

## 검증 순서

```text
웹 타입 검사
→ CAD 단위·컴포넌트 테스트
→ 웹 프로덕션 빌드
→ localhost 실제 브라우저에서 전용 창 실행 확인
→ Google Drive 클릭·드래그 앤 드롭 UAT
→ CAD Viewer 계정 로그인 후 실제 DWG/DXF 렌더링 확인
```

CAD-1부터 CAD-3까지 완료했다. CAD-4는 사용자의 CAD Viewer 계정 로그인과 실제 파일 확인이 필요하며, CAD-5는 운영 배포를 결정할 때 진행한다.
