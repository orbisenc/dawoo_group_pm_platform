"use client";

import { usePathname } from "next/navigation";

import { navigation } from "../../lib/navigation";
import { useProject } from "./project-context";
import { GlobalSearch } from "./global-search";

export function TopHeader() {
  const pathname = usePathname();
  const { selectedProject } = useProject();
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
        <GlobalSearch />
        <button className="icon-button" type="button" aria-label="알림">
          <span aria-hidden="true">♢</span><i />
        </button>
        <button className="help-button" type="button" aria-label="도움말">?</button>
      </div>
    </header>
  );
}
