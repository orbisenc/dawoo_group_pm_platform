import Link from "next/link";
import type { ReactNode } from "react";

export function PublicDocument({ title, updatedAt, children }: { title: string; updatedAt: string; children: ReactNode }) {
  return (
    <main className="public-document-page">
      <article className="public-document">
        <header>
          <Link href="/" className="public-document-brand">다우그룹 PROJECT HUB</Link>
          <h1>{title}</h1>
          <p>시행일 및 최종 업데이트: {updatedAt}</p>
        </header>
        <div className="public-document-content">{children}</div>
        <footer>
          <Link href="/">로그인 화면으로 돌아가기</Link>
          <Link href="/privacy">개인정보 처리방침</Link>
          <Link href="/terms">이용약관</Link>
          <Link href="/help">사용자 도움말</Link>
        </footer>
      </article>
    </main>
  );
}
