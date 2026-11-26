export type IconName =
  | "dashboard"
  | "projects"
  | "issues"
  | "drive"
  | "calendar"
  | "viewer"
  | "cad"
  | "approvals"
  | "admin";

export interface NavigationItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: string;
  group?: "viewer" | "asset-status";
}

export const navigation: NavigationItem[] = [
  { href: "/", label: "통합 대시보드", icon: "dashboard" },
  { href: "/issues", label: "이슈 피드", icon: "issues" },
  { href: "/drive", label: "공유 드라이브", icon: "drive" },
  { href: "/calendar", label: "일정", icon: "calendar" },
  { href: "/approvals", label: "결재", icon: "approvals" },
  { href: "/admin", label: "관리자", icon: "admin" },
  { href: "/drawing-status", label: "2D 도면 현황", icon: "cad", group: "asset-status" },
  { href: "/model-status", label: "3D 모델 현황", icon: "viewer", group: "asset-status" },
  { href: "/cad", label: "CAD 도면 뷰어", icon: "cad", group: "viewer" },
  { href: "/viewer", label: "3D/BIM 뷰어", icon: "viewer", badge: "3D", group: "viewer" },
  { href: "/projects", label: "프로젝트", icon: "projects", badge: "3" },
];

export const sectionSlugs = [
  ...navigation
    .map(({ href }) => href.slice(1))
    .filter((slug) => slug.length > 0),
];

export const getNavigationItem = (slug: string) =>
  navigation.find(({ href }) => href === `/${slug}`);
