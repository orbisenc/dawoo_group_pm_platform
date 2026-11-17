import type { ReactNode } from "react";

import { Sidebar } from "./sidebar";
import { TopHeader } from "./top-header";
import { ProjectProvider } from "./project-context";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ProjectProvider>
      <div className="app-shell">
        <Sidebar />
        <div className="app-frame">
          <TopHeader />
          <main className="app-content">{children}</main>
        </div>
      </div>
    </ProjectProvider>
  );
}
