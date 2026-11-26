# 샘플 자산 출처와 라이선스

## PROJECT HUB 아파트 101동

- 파일: `apps/web/public/samples/models/project-hub-apartment-tower.glb`
- 형식: glTF 2.0 Binary(GLB)
- 제작 방식: `scripts/generate-apartment-glb.mjs`가 Three.js 기본 도형을 조합해 생성
- 구성: 18층 공동주택 1개 동, 저층부, 발코니, 창호, 출입구 캐노피, 옥상 구조물
- 제작자: PROJECT HUB
- 외부 모델·텍스처: 사용하지 않음
- 사용 조건: PROJECT HUB 프로젝트 내부 사용
- 재생성: 저장소 루트에서 `node scripts/generate-apartment-glb.mjs`

이 자산은 MVP의 라이선스가 확인된 고정 GLB 샘플 요구를 충족하기 위해 저장소 안에서 직접 제작했다. 대용량 3D 코드는 3D 모델 현황과 통합 대시보드 BIM 미리보기에서 동적으로 불러오며 두 화면은 같은 GLB를 사용한다.

## S-202 지상1층 구조평면도

- 원본 형식: DWG
- 상태 화면: `/drawing-status`
- 공개 변환본: `apps/web/public/samples/drawings/S-202-ground-floor-structural-plan.png`
- 변환 범위: DWG 첫 번째 종이공간(배치1), S-202 전체 도곽
- 변환 방식: 로컬 AutoCAD Core Console PDF 출력 후 300 DPI PNG 렌더링
- 원본 보관: 사내 공유 드라이브에 유지하며 웹 공개 자산에는 복사하지 않음

사용자가 도면 변환본의 웹 공개를 승인한 뒤 실제 DWG의 첫 번째 종이공간을 고해상도 이미지로 변환했다. `/drawing-status`는 이 이미지를 확대·축소·드래그·키보드 이동 방식으로 표시한다. 원본 DWG 자체는 정적 URL로 제공하지 않는다.
