import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "../components/dashboard/app-shell";
import "./globals.css";
import "./mobile.css";

export const metadata: Metadata = {
  title: "다우그룹 PROJECT HUB",
  description: "다우그룹 건설 개발사업 참여자를 위한 통합 프로젝트 협업 플랫폼",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
