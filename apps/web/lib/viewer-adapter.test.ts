import { describe, expect, it } from "vitest";

import { DemoViewerAdapter, type ViewerAdapter } from "./viewer-adapter";

describe("DemoViewerAdapter", () => {
  it("외부 모델 다운로드 없이 건물 구성 객체를 제공한다", async () => {
    const adapter: ViewerAdapter = new DemoViewerAdapter();
    const objects = await adapter.loadObjects();

    expect(objects).toHaveLength(8);
    expect(objects.map((object) => object.floorKey)).toEqual(expect.arrayContaining(["대지", "저층부", "4층", "8층", "옥상"]));
    expect(objects.every((object) => object.id && object.name && object.memberType)).toBe(true);
  });

  it("선택 객체에 새 이슈를 연결한다", async () => {
    const adapter = new DemoViewerAdapter();
    const created = await adapter.createIssue({ objectId: "ROOF-001", title: "옥상 방수 상세 검토" });
    const issues = await adapter.loadIssues("ROOF-001");

    expect(created.objectId).toBe("ROOF-001");
    expect(created.status).toBe("등록");
    expect(issues).toContainEqual(created);
    expect(await adapter.loadIssues("TOWER-05")).not.toContainEqual(created);
  });
});
