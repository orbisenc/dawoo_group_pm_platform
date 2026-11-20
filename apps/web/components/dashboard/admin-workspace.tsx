"use client";

import { useCallback, useEffect, useState } from "react";

import {
  useAuth,
  type ApprovedAccount,
  type ApprovedAccountsResult,
  type PendingRegistration,
} from "../auth/auth-context";

const emptyResult: ApprovedAccountsResult = {
  summary: { approvedAccounts: 0, administrators: 0, users: 0 },
  items: [],
};

function dateText(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function AdminWorkspace() {
  const {
    isAdmin,
    listApprovedAccounts,
    updateAccountRole,
    listRegistrations,
    decideRegistration,
  } = useAuth();
  const [tab, setTab] = useState<"accounts" | "registrations">("accounts");
  const [accounts, setAccounts] = useState<ApprovedAccountsResult>(emptyResult);
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const [approved, pending] = await Promise.all([listApprovedAccounts(), listRegistrations()]);
      setAccounts(approved);
      setRegistrations(pending);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "관리자 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, listApprovedAccounts, listRegistrations]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    void Promise.all([listApprovedAccounts(), listRegistrations()])
      .then(([approved, pending]) => {
        if (!active) return;
        setAccounts(approved);
        setRegistrations(pending);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "관리자 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [isAdmin, listApprovedAccounts, listRegistrations]);

  if (!isAdmin) {
    return (
      <section className="admin-access-denied" role="alert">
        <strong>관리자 권한이 필요합니다.</strong>
        <p>이 화면은 플랫폼 관리자만 사용할 수 있습니다.</p>
      </section>
    );
  }

  async function changeRole(account: ApprovedAccount, platformRole: "PLATFORM_ADMIN" | "USER") {
    setBusyId(account.id);
    setError("");
    try {
      await updateAccountRole(account.id, platformRole);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "계정 역할을 변경하지 못했습니다.");
    } finally {
      setBusyId("");
    }
  }

  async function decide(userId: string, decision: "approve" | "reject") {
    if (decision === "reject" && !window.confirm("이 회원가입 신청을 거절할까요?")) return;
    setBusyId(userId);
    setError("");
    try {
      await decideRegistration(userId, decision);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "회원가입 신청을 처리하지 못했습니다.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <div className="section-title admin-section-title">
        <div>
          <span className="admin-live-label"><i /> 실제 가입 데이터</span>
          <h2>관리자</h2>
          <p>회원가입 승인과 승인 완료 계정의 플랫폼 역할을 관리합니다.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "새로고침 중" : "새로고침"}
        </button>
      </div>

      <div className="admin-summary-grid" aria-label="승인 계정 현황">
        <article><span>승인 계정</span><strong>{accounts.summary.approvedAccounts}명</strong><small>회원가입 후 승인 완료</small></article>
        <article><span>관리자</span><strong>{accounts.summary.administrators}명</strong><small>플랫폼 관리자 역할</small></article>
        <article><span>아이디 보유자</span><strong>{accounts.summary.users}명</strong><small>승인된 일반 사용자</small></article>
        <article><span>승인 대기</span><strong>{registrations.length}명</strong><small>관리자 검토 필요</small></article>
      </div>

      {error ? <p className="auth-error" role="alert">{error}</p> : null}

      <div className="admin-grid">
        <aside className="settings-menu" aria-label="관리자 기능">
          <button className={tab === "accounts" ? "active" : ""} type="button" onClick={() => setTab("accounts")}>계정 및 권한</button>
          <button className={tab === "registrations" ? "active" : ""} type="button" onClick={() => setTab("registrations")}>가입 승인 {registrations.length ? `(${registrations.length})` : ""}</button>
        </aside>

        {tab === "accounts" ? (
          <section className="data-panel admin-table">
            <div className="panel-heading"><div><span className="panel-kicker">APPROVED ACCOUNTS</span><h3>승인 계정 {accounts.summary.approvedAccounts}명</h3></div></div>
            <div className="data-head member-columns"><span>계정</span><span>이메일</span><span>플랫폼 역할</span><span>승인일</span></div>
            {loading ? <div className="admin-empty-state">승인 계정을 불러오고 있습니다.</div> : accounts.items.length ? accounts.items.map((account) => (
              <div className="data-row member-columns" key={account.id}>
                <span><i className="mini-avatar">{account.name[0]}</i><span><strong>{account.name}</strong><small>@{account.username}</small></span></span>
                <span>{account.email}</span>
                <span>
                  <select aria-label={`${account.name} 플랫폼 역할`} value={account.platformRole} disabled={busyId === account.id} onChange={(event) => void changeRole(account, event.target.value as "PLATFORM_ADMIN" | "USER")}>
                    <option value="USER">일반 사용자</option>
                    <option value="PLATFORM_ADMIN">관리자</option>
                  </select>
                </span>
                <span>{dateText(account.approvedAt)}</span>
              </div>
            )) : <div className="admin-empty-state"><strong>승인 완료된 가입 계정이 없습니다.</strong><span>회원가입 신청을 승인하면 이 목록과 집계에 표시됩니다.</span></div>}
          </section>
        ) : (
          <section className="data-panel admin-table">
            <div className="panel-heading"><div><span className="panel-kicker">REGISTRATION REQUESTS</span><h3>가입 승인 대기 {registrations.length}명</h3></div></div>
            <div className="data-head registration-columns"><span>신청자</span><span>이메일</span><span>신청일</span><span>처리</span></div>
            {loading ? <div className="admin-empty-state">가입 신청을 불러오고 있습니다.</div> : registrations.length ? registrations.map((item) => (
              <div className="data-row registration-columns" key={item.id}>
                <span><i className="mini-avatar">{item.name[0]}</i><span><strong>{item.name}</strong><small>@{item.username}</small></span></span>
                <span>{item.email}</span>
                <span>{dateText(item.createdAt)}</span>
                <span className="admin-decision-actions"><button type="button" disabled={busyId === item.id} onClick={() => void decide(item.id, "reject")}>거절</button><button type="button" disabled={busyId === item.id} onClick={() => void decide(item.id, "approve")}>승인</button></span>
              </div>
            )) : <div className="admin-empty-state"><strong>승인 대기 중인 신청이 없습니다.</strong><span>새 회원가입 신청이 접수되면 여기에 표시됩니다.</span></div>}
          </section>
        )}
      </div>
    </>
  );
}
