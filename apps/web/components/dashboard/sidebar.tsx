"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { navigation } from "../../lib/navigation";
import {
  countUnreadIssues,
  markNavigationSectionSeen,
  navigationBadgeEvent,
  readSeenAt,
} from "../../lib/navigation-badges";
import { Icon } from "./icon";
import { useProject } from "./project-context";
import { useAuth } from "../auth/auth-context";

export function Sidebar() {
  const pathname = usePathname();
  const { selectedProject } = useProject();
  const { user, token, isAdmin, logout, authorizedFetch } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navigationBadges, setNavigationBadges] = useState({ issues: 0, approvals: 0 });
  const userMenuRef = useRef<HTMLDivElement>(null);
  const visibleNavigation = navigation.filter((item) => item.href !== "/admin" || isAdmin);
  const projectNavigation = visibleNavigation.find((item) => item.href === "/projects");
  const primaryNavigation = visibleNavigation.filter((item) => item.href !== "/projects");

  useEffect(() => {
    let active = true;
    const refreshBadges = async () => {
      if (!user?.id) return { issues: 0, approvals: 0 };
      const projectId = selectedProject.id;
      const issuesOpen = pathname.startsWith("/issues");
      const approvalsOpen = pathname.startsWith("/approvals");
      if (issuesOpen) markNavigationSectionSeen("issues", user.id, projectId);
      if (approvalsOpen) markNavigationSectionSeen("approvals", user.id, projectId);

      const issues = issuesOpen
        ? 0
        : await countUnreadIssues(projectId, readSeenAt("issues", user.id, projectId));
      let approvals = 0;
      if (!approvalsOpen && token && !token.startsWith("local:")) {
        try {
          const response = await authorizedFetch(`/projects/${projectId}/approvals?scope=all`);
          if (response.ok) {
            const result = await response.json() as {
              items?: Array<{ status: string; updatedAt: string }>;
            };
            const seenAt = readSeenAt("approvals", user.id, projectId);
            approvals = (result.items ?? []).filter(
              (item) => item.status === "IN_REVIEW" && (!seenAt || item.updatedAt > seenAt),
            ).length;
          }
        } catch {
          approvals = 0;
        }
      }
      return { issues, approvals };
    };
    const updateBadges = () => {
      void refreshBadges().then((next) => {
        if (active) setNavigationBadges(next);
      });
    };
    updateBadges();
    const intervalId = window.setInterval(updateBadges, 30_000);
    window.addEventListener(navigationBadgeEvent, updateBadges);
    window.addEventListener("focus", updateBadges);
    window.addEventListener("storage", updateBadges);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener(navigationBadgeEvent, updateBadges);
      window.removeEventListener("focus", updateBadges);
      window.removeEventListener("storage", updateBadges);
    };
  }, [authorizedFetch, pathname, selectedProject.id, token, user?.id]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false);
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, [userMenuOpen]);

  const navigationLink = (item: (typeof navigation)[number]) => {
    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    const className = ["nav-item", item.href === "/projects" ? "project-navigation-item" : "", active ? "active" : ""]
      .filter(Boolean)
      .join(" ");
    const liveBadge = item.href === "/issues"
      ? navigationBadges.issues
      : item.href === "/approvals"
        ? navigationBadges.approvals
        : null;
    const badge = liveBadge === null
      ? item.badge
      : liveBadge > 0
        ? liveBadge > 99 ? "99+" : String(liveBadge)
        : undefined;
    return (
      <Link className={className} href={item.href} key={item.href}>
        <Icon name={item.icon} />
        <span>{item.label}</span>
        {badge ? <small aria-label={liveBadge === null ? undefined : `${item.label} 미확인 ${liveBadge}건`}>{badge}</small> : null}
      </Link>
    );
  };

  return (
    <aside className="sidebar">
      <Link className="sidebar-brand" href="/" aria-label="다우그룹 프로젝트 허브 통합 대시보드">
        <span className="brand-logo-frame">
          <Image
            src="/images/dawoo-group-logo-white.png"
            alt="주식회사 다우그룹"
            width={210}
            height={140}
            priority
          />
        </span>
      </Link>

      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="주요 메뉴">
        {primaryNavigation.map(navigationLink)}
        {projectNavigation ? navigationLink(projectNavigation) : null}
      </nav>

      <div className="sidebar-project">
        <span className="project-thumb" aria-hidden="true">DW</span>
        <div><small>현재 프로젝트</small><strong>{selectedProject.name}</strong></div>
        <span className="project-chevron" aria-hidden="true">⌄</span>
      </div>
      <div className="sidebar-user" ref={userMenuRef}>
        <span className="avatar">{user?.name[0] ?? "사"}</span>
        <div><strong>{user?.name}</strong><small>{isAdmin ? "시스템 관리자" : "승인 사용자"}</small></div>
        <button
          className={userMenuOpen ? "sidebar-user-menu-trigger active" : "sidebar-user-menu-trigger"}
          type="button"
          aria-label="사용자 메뉴"
          aria-expanded={userMenuOpen}
          aria-controls="sidebar-user-menu"
          onClick={() => setUserMenuOpen((current) => !current)}
        >•••</button>
        {userMenuOpen ? (
          <div className="sidebar-user-menu" id="sidebar-user-menu" role="menu" aria-label="계정 메뉴">
            <div className="sidebar-user-menu-account">
              <strong>{user?.name}</strong>
              <span>{user?.username ? `@${user.username}` : user?.email}</span>
              {user?.username ? <small>{user.email}</small> : null}
            </div>
            <Link href="/projects" role="menuitem" onClick={() => setUserMenuOpen(false)}>프로젝트 관리</Link>
            {isAdmin ? <Link href="/admin" role="menuitem" onClick={() => setUserMenuOpen(false)}>관리자 설정</Link> : null}
            <button className="sidebar-user-menu-logout" type="button" role="menuitem" onClick={logout}>로그아웃</button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
