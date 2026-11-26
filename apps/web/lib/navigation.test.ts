import { describe, expect, it } from "vitest";

import { navigation, sectionSlugs } from "./navigation";

describe("대시보드 내비게이션", () => {
  it("프로젝트 기획 현황과 뷰어 기능을 분리한 11개 메뉴를 제공한다", () => {
    expect(navigation.map(({ label }) => label)).toEqual([
      "통합 대시보드",
      "이슈 피드",
      "공유 드라이브",
      "일정",
      "결재",
      "관리자",
      "2D 도면 현황",
      "3D 모델 현황",
      "CAD 도면 뷰어",
      "3D/BIM 뷰어",
      "프로젝트",
    ]);
  });

  it("노출된 프로젝트 화면을 포함한 섹션 경로를 유지한다", () => {
    expect(sectionSlugs).toHaveLength(10);
    expect(sectionSlugs).toContain("projects");
    expect(sectionSlugs).toContain("model-status");
    expect(sectionSlugs).toContain("drawing-status");
    expect(new Set(navigation.map(({ href }) => href)).size).toBe(11);
  });
});
