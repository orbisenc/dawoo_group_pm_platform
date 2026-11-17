import { describe, expect, it } from "vitest";

import { navigation, sectionSlugs } from "./navigation";

describe("대시보드 내비게이션", () => {
  it("프로젝트 탭을 포함한 9개 메뉴를 제공한다", () => {
    expect(navigation.map(({ label }) => label)).toEqual([
      "통합 대시보드",
      "프로젝트",
      "이슈 피드",
      "공유 드라이브",
      "일정",
      "3D/BIM 뷰어",
      "CAD 도면",
      "결재",
      "관리자",
    ]);
  });

  it("노출된 프로젝트 화면을 포함한 섹션 경로를 유지한다", () => {
    expect(sectionSlugs).toHaveLength(8);
    expect(sectionSlugs).toContain("projects");
    expect(new Set(navigation.map(({ href }) => href)).size).toBe(9);
  });
});
