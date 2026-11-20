export type ProjectFact = {
  label: string;
  value: string;
};

export type DawooProject = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  category: string;
  organization: string;
  location: string;
  workspaceReadiness: number;
  image: string;
  description: string;
  facts: ProjectFact[];
  sourceUrl: string;
};

export const dawooProjects: DawooProject[] = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    code: "DW-UIWANG",
    name: "의왕 학의지구 도시개발사업",
    shortName: "의왕 학의지구",
    category: "도시개발",
    organization: "(주)다우그룹",
    location: "경기 의왕시 학의동 · 백운밸리 2지구",
    workspaceReadiness: 72,
    image: "/images/project-uiwang.png",
    description:
      "공원과 하천, 보행축을 중심으로 3개 주거 블록을 하나의 생활권으로 연결하는 공동주택 개발사업입니다.",
    facts: [
      { label: "사업면적", value: "94,065㎡" },
      { label: "사업규모", value: "총 1,197세대" },
      { label: "건축규모", value: "3개 블록 · 전 동 20층" },
    ],
    sourceUrl: "https://www.dawoogroup.co.kr/projects/uiwang",
  },
  {
    id: "eulwangri-sunset-island",
    code: "DW-SUNSET",
    name: "인천 을왕리 Sunset Island 복합리조트",
    shortName: "을왕리 Sunset Island",
    category: "복합리조트",
    organization: "(주)다우개발 · (주)다우그룹",
    location: "인천 중구 을왕동 산 70 일원",
    workspaceReadiness: 58,
    image: "/images/project-eulwangri.png",
    description:
      "호텔과 독립형 빌라, 해상 웨딩 아일랜드를 연결하는 프리미엄 오션 복합리조트 개발사업입니다.",
    facts: [
      { label: "총사업비", value: "6,700억원" },
      { label: "객실", value: "호텔 370실 · 빌라 90실" },
      { label: "핵심시설", value: "해상 웨딩 아일랜드" },
    ],
    sourceUrl:
      "https://www.dawoogroup.co.kr/projects/eulwangri-sunset-island-resort",
  },
  {
    id: "sewoon2-district",
    code: "DW-SEWOON2",
    name: "세운2지구 글로벌 프리미엄 복합개발사업",
    shortName: "세운2지구 복합개발",
    category: "도심 복합개발",
    organization: "(주)다우그룹",
    location: "서울 종로구 장사동 67 일대",
    workspaceReadiness: 46,
    image: "/images/project-sewoon.png",
    description:
      "주거·호텔·업무·상업·웰니스와 미래 모빌리티를 연결하는 서울 도심형 글로벌 랜드마크 개발 구상입니다.",
    facts: [
      { label: "개발 프로그램", value: "96,750평" },
      { label: "핵심시설", value: "6개 복합 프로그램" },
      { label: "스마트 주차", value: "지하 5개 층 · 3,600대" },
    ],
    sourceUrl: "https://www.dawoogroup.co.kr/projects/sewoon2-district",
  },
];

export const findDawooProject = (projectId: string) =>
  dawooProjects.find((project) => project.id === projectId) ?? dawooProjects[0]!;
