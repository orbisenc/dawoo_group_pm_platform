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
}

export const navigation: NavigationItem[] = [
  { href: "/", label: "통합 대시보드", icon: "dashboard" },
  { href: "/projects", label: "프로젝트", icon: "projects", badge: "3" },
  { href: "/issues", label: "이슈 피드", icon: "issues", badge: "8" },
  { href: "/drive", label: "공유 드라이브", icon: "drive" },
  { href: "/calendar", label: "일정", icon: "calendar" },
  { href: "/viewer", label: "3D/BIM 뷰어", icon: "viewer", badge: "샘플" },
  { href: "/cad", label: "CAD 도면", icon: "cad" },
  { href: "/approvals", label: "결재", icon: "approvals", badge: "3" },
  { href: "/admin", label: "관리자", icon: "admin" },
];

export const sectionSlugs = [
  ...navigation
    .map(({ href }) => href.slice(1))
    .filter((slug) => slug.length > 0),
];

export const getNavigationItem = (slug: string) =>
  navigation.find(({ href }) => href === `/${slug}`);
