import Image from "next/image";

export function BuildingPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={compact ? "building-preview compact premium" : "building-preview premium"}
      aria-label="고해상도 BIM 캠퍼스 데모 모델 미리보기"
    >
      <Image
        src="/images/bim-campus.png"
        alt="복합 업무시설과 설비 배관을 표현한 BIM 캠퍼스 데모 모델"
        fill
        sizes={compact ? "(max-width: 850px) 100vw, 50vw" : "100vw"}
        priority={compact}
      />
      <div className="viewer-model-shade" />
      <span className="viewer-sample">고해상도 BIM 데모 모델</span>
      <span className="viewer-quality"><b>LOD 300</b><small>건축 · 구조 · MEP 통합</small></span>
      <span className="viewer-axis"><i>X</i><i>Y</i><i>Z</i></span>
    </div>
  );
}
