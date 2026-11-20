"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Result = { type: "PROJECT" | "ISSUE" | "FILE" | "CALENDAR" | "APPROVAL"; id: string; title: string; subtitle: string; href: string };
const labels: Record<Result["type"], string> = { PROJECT: "프로젝트", ISSUE: "이슈", FILE: "파일", CALENDAR: "일정", APPROVAL: "결재" };

export function GlobalSearch() {
  const [query, setQuery] = useState(""); const [items, setItems] = useState<Result[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const token = useRef("");
  useEffect(() => { void (async () => { try { const response = await fetch("/backend/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "partner@projecthub.local" }) }); if (response.ok) token.current = ((await response.json()) as { accessToken: string }).accessToken; } catch { /* 검색 시 연결 오류를 표시한다. */ } })(); }, []);
  useEffect(() => { if (query.trim().length < 2) return; const controller = new AbortController(); const timer = window.setTimeout(() => { void (async () => { setLoading(true); setError(""); try { if (!token.current) throw new Error(); const response = await fetch(`/backend/search?query=${encodeURIComponent(query.trim())}&limit=8`, { signal: controller.signal, headers: { authorization: `Bearer ${token.current}` } }); if (!response.ok) throw new Error(); setItems(((await response.json()) as { items: Result[] }).items); } catch (reason) { if ((reason as Error).name !== "AbortError") setError("검색 서비스를 연결할 수 없습니다."); } finally { setLoading(false); } })(); }, 250); return () => { window.clearTimeout(timer); controller.abort(); }; }, [query]);
  const open = query.trim().length >= 2;
  return <div className="global-search-wrap"><label className="global-search"><span aria-hidden="true">⌕</span><span className="sr-only">통합 검색</span><input aria-label="프로젝트 전체 검색" placeholder="프로젝트, 이슈, 파일 통합 검색" type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }} /><kbd>⌘ K</kbd></label>{open && <div className="global-search-results" role="listbox" aria-label="통합 검색 결과"><header><strong>통합 검색</strong><span>권한 범위 내 결과만 표시</span></header>{loading && <p>검색 중입니다…</p>}{error && <p className="search-error">{error}</p>}{!loading && !error && items.map((item) => <Link href={item.href} onClick={() => setQuery("")} key={`${item.type}-${item.id}`}><b>{labels[item.type]}</b><span><strong>{item.title}</strong><small>{item.subtitle}</small></span></Link>)}{!loading && !error && items.length === 0 && <p>검색 결과가 없습니다. 다른 검색어를 입력해 주세요.</p>}</div>}</div>;
}
