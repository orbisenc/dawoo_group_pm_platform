"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigation } from "../../lib/navigation";
import { Icon } from "./icon";
import { useProject } from "./project-context";

export function Sidebar() {
  const pathname = usePathname();
  const { selectedProject } = useProject();

  return (
    <aside className="sidebar">
      <Link className="sidebar-brand" href="/" aria-label="다우그룹 프로젝트 허브 통합 대시보드">
        <span className="brand-logo-frame">
          <Image
            src="/images/dawoo-group-logo.jpg"
            alt="주식회사 다우그룹"
            width={122}
            height={80}
            priority
          />
        </span>
        <span className="brand-copy"><strong>PROJECT</strong><b>HUB</b></span>
      </Link>

      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="주요 메뉴">
        {navigation.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link className={active ? "nav-item active" : "nav-item"} href={item.href} key={item.href}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.badge && <small>{item.badge}</small>}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-project">
        <span className="project-thumb" aria-hidden="true">DW</span>
        <div><small>현재 프로젝트</small><strong>{selectedProject.name}</strong></div>
        <span className="project-chevron" aria-hidden="true">⌄</span>
      </div>
      <div className="sidebar-user">
        <span className="avatar">김</span>
        <div><strong>김지훈</strong><small>개발사업 PM</small></div>
        <button type="button" aria-label="사용자 메뉴">•••</button>
      </div>
    </aside>
  );
}
