"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AuthProvider } from "../auth/auth-context";
import { LoginGate } from "../auth/login-gate";
import { Sidebar } from "./sidebar";
import { TopHeader } from "./top-header";
import { ProjectProvider } from "./project-context";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicDocument = ["/privacy", "/terms", "/help"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isPublicDocument) return children;

  return (
    <AuthProvider>
      <LoginGate>
        <ProjectProvider>
          <div className="app-shell">
            <Sidebar />
            <div className="app-frame">
              <TopHeader />
              <main className="app-content">{children}</main>
            </div>
          </div>
        </ProjectProvider>
      </LoginGate>
    </AuthProvider>
  );
}
