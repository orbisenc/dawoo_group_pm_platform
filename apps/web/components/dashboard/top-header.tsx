"use client";

import { usePathname } from "next/navigation";

import { navigation } from "../../lib/navigation";
import { useProject } from "./project-context";
import { GlobalSearch } from "./global-search";
import { NotificationCenter } from "./notification-center";
import { AdminRegistrations } from "../auth/admin-registrations";
import { useAuth } from "../auth/auth-context";

export function TopHeader() {
  const pathname = usePathname();
  const { selectedProject } = useProject();
  const { user, logout } = useAuth();
  const current = navigation.find(({ href }) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href),
  );

  return (
    <header className="app-header">
      <div>
        <p>DAWOO GROUP / PROJECT HUB / {selectedProject.name}</p>
        <h1>{current?.label ?? "프로젝트 허브"}</h1>
      </div>
      <div className="header-actions">
        <AdminRegistrations />
        <GlobalSearch />
        <NotificationCenter />
        <button className="help-button" type="button" aria-label="도움말">?</button>
        <div className="header-account"><span>{user?.name}</span><button type="button" onClick={logout}>로그아웃</button></div>
      </div>
    </header>
  );
}
