export type ConstructionStatus = "공사 전" | "시공 중" | "완료" | "검토 필요";

export type ViewerObject = {
  id: string;
  name: string;
  floor: string;
  floorKey: string;
  memberType: string;
  status: ConstructionStatus;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
};

export type ViewerIssue = {
  id: string;
  objectId: string;
  title: string;
  status: "등록" | "검토 중" | "진행 중" | "완료";
  createdAt: string;
};

export type CreateViewerIssueInput = {
  objectId: string;
  title: string;
};

/** IFC 등 실제 모델 공급자가 바뀌어도 화면이 이 계약만 사용하도록 분리한다. */
export interface ViewerAdapter {
  readonly modelId: string;
  readonly modelName: string;
  loadObjects(): Promise<ViewerObject[]>;
  loadIssues(objectId: string): Promise<ViewerIssue[]>;
  createIssue(input: CreateViewerIssueInput): Promise<ViewerIssue>;
}

const objects: ViewerObject[] = [
  { id: "SITE-001", name: "프로젝트 대지", floor: "대지", floorKey: "대지", memberType: "대지", status: "완료", position: [0, -0.35, 0], size: [18, 0.6, 15], color: "#365f59" },
  { id: "PODIUM-01", name: "저층부 상업시설", floor: "지상 1~3층", floorKey: "저층부", memberType: "철근콘크리트", status: "시공 중", position: [0, 1.35, 0], size: [11, 2.8, 8], color: "#79aeb1" },
  { id: "TOWER-04", name: "업무시설 4층", floor: "지상 4층", floorKey: "4층", memberType: "철골·커튼월", status: "완료", position: [0, 3.45, 0], size: [7, 1.1, 5.5], color: "#397d89" },
  { id: "TOWER-05", name: "업무시설 5층", floor: "지상 5층", floorKey: "5층", memberType: "철골·커튼월", status: "완료", position: [0, 4.65, 0], size: [7, 1.1, 5.5], color: "#438e98" },
  { id: "TOWER-06", name: "업무시설 6층", floor: "지상 6층", floorKey: "6층", memberType: "철골·커튼월", status: "시공 중", position: [0, 5.85, 0], size: [7, 1.1, 5.5], color: "#397d89" },
  { id: "TOWER-07", name: "업무시설 7층", floor: "지상 7층", floorKey: "7층", memberType: "철골·커튼월", status: "검토 필요", position: [0, 7.05, 0], size: [7, 1.1, 5.5], color: "#438e98" },
  { id: "TOWER-08", name: "업무시설 8층", floor: "지상 8층", floorKey: "8층", memberType: "철골·커튼월", status: "공사 전", position: [0, 8.25, 0], size: [7, 1.1, 5.5], color: "#397d89" },
  { id: "ROOF-001", name: "옥상 기계실", floor: "옥상", floorKey: "옥상", memberType: "기계실", status: "공사 전", position: [0, 9.45, 0], size: [3.6, 1.1, 3], color: "#8cb5b3" },
];

const seedIssues: ViewerIssue[] = [
  { id: "BIM-104", objectId: "TOWER-07", title: "7층 외장 커튼월 접합부 검토", status: "검토 중", createdAt: "2026. 10. 28." },
  { id: "BIM-087", objectId: "PODIUM-01", title: "저층부 코어 벽체 개구부 확인", status: "진행 중", createdAt: "2026. 10. 24." },
];

export class DemoViewerAdapter implements ViewerAdapter {
  readonly modelId = "project-hub-demo-building-v1";
  readonly modelName = "용산 리버파크 자체 생성 데모 모델";
  private readonly issues = [...seedIssues];

  async loadObjects() {
    return objects.map((object) => ({ ...object }));
  }

  async loadIssues(objectId: string) {
    return this.issues.filter((issue) => issue.objectId === objectId).map((issue) => ({ ...issue }));
  }

  async createIssue(input: CreateViewerIssueInput) {
    const issue: ViewerIssue = {
      id: `DEMO-${String(this.issues.length + 1).padStart(3, "0")}`,
      objectId: input.objectId,
      title: input.title.trim(),
      status: "등록",
      createdAt: new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    };
    this.issues.unshift(issue);
    return { ...issue };
  }
}
