"use client";

import { useEffect, useState } from "react";

import { useAuth } from "./auth-context";

type Registration = { id: string; username: string; email: string; name: string; createdAt: string };

export function AdminRegistrations() {
  const { isAdmin, listRegistrations, decideRegistration } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Registration[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    if (!isAdmin || !open) return;
    void listRegistrations()
      .then(setItems)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "회원가입 신청을 불러오지 못했습니다."));
  }, [isAdmin, listRegistrations, open]);

  if (!isAdmin) return null;

  async function decide(userId: string, decision: "approve" | "reject") {
    if (decision === "reject" && !window.confirm("이 회원가입 신청을 거절할까요?")) return;
    setBusyId(userId);
    setError("");
    try {
      await decideRegistration(userId, decision);
      setItems((current) => current.filter((item) => item.id !== userId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "회원가입 신청을 처리하지 못했습니다.");
    } finally {
      setBusyId("");
    }
  }

  return <>
    <button className="admin-registration-button" type="button" onClick={() => setOpen(true)}>가입 승인 {items.length ? <b>{items.length}</b> : null}</button>
    {open ? <div className="admin-modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}><section className="admin-registration-modal" role="dialog" aria-modal="true" aria-labelledby="registration-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span>ADMINISTRATION</span><h2 id="registration-title">회원가입 승인 관리</h2><p>신청 정보를 확인하고 계정 사용을 승인하거나 거절합니다.</p></div><button type="button" aria-label="회원가입 승인 창 닫기" onClick={() => setOpen(false)}>×</button></header>{error ? <p className="auth-error" role="alert">{error}</p> : null}<div className="registration-list">{items.length ? items.map((item) => <article key={item.id}><div className="registration-avatar">{item.name[0]}</div><div><strong>{item.name}</strong><span>@{item.username} · {item.email}</span><small>신청일 {new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(item.createdAt))}</small></div><div><button type="button" disabled={busyId === item.id} onClick={() => void decide(item.id, "reject")}>거절</button><button type="button" disabled={busyId === item.id} onClick={() => void decide(item.id, "approve")}>승인</button></div></article>) : <div className="registration-empty"><strong>승인 대기 신청이 없습니다.</strong><span>새 회원가입 신청이 접수되면 이곳에 표시됩니다.</span></div>}</div></section></div> : null}
  </>;
}
