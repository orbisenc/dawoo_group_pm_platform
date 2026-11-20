"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { useAuth } from "./auth-context";

export function LoginGate({ children }: { children: ReactNode }) {
  const { user, loading, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (mode === "register" && password !== confirmPassword) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        const message = await register({ name, username, email, password });
        setNotice(message);
        setMode("login");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "요청을 처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="auth-loading"><span>PROJECT HUB</span><p>로그인 정보를 확인하고 있습니다.</p></div>;
  if (user) return children;

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand-logo"><Image src="/images/dawoo-group-logo-white.png" alt="주식회사 다우그룹" width={240} height={160} priority /></div>
        <h1>PROJECT HUB</h1>
        <p>개발사업의 의사결정, 프로젝트 자료와 협업 현황을 안전하게 관리합니다.</p>
        <ul><li>프로젝트 통합 현황</li><li>이슈와 의사결정 관리</li><li>공유 문서와 일정 연동</li></ul>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-card">
          <header>
            <span>{mode === "login" ? "WELCOME BACK" : "JOIN PROJECT HUB"}</span>
            <h2>{mode === "login" ? "로그인" : "회원가입 신청"}</h2>
            <p>{mode === "login" ? "승인된 계정으로 로그인해 주세요." : "신청 후 관리자 승인이 완료되어야 로그인할 수 있습니다."}</p>
          </header>
          {process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH === "true" ? <div className="auth-notice" role="status">테스트용 로그인 모드입니다. 입력한 데이터는 이 브라우저에만 저장됩니다.</div> : null}
          {notice ? <div className="auth-notice" role="status">{notice}</div> : null}
          {error ? <div className="auth-error" role="alert">{error}</div> : null}
          <form onSubmit={submit}>
            {mode === "register" ? <label><span>이름</span><input aria-label="이름" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required placeholder="이름을 입력하세요" /></label> : null}
            <label><span>아이디</span><input aria-label="아이디" value={username} onChange={(event) => setUsername(event.target.value)} minLength={4} maxLength={50} autoComplete="username" required placeholder="아이디를 입력하세요" /></label>
            {mode === "register" ? <label><span>이메일</span><input aria-label="이메일" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="name@company.com" /></label> : null}
            <label><span>비밀번호</span><input aria-label="비밀번호" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} required placeholder="비밀번호를 입력하세요" /></label>
            {mode === "register" ? <label><span>비밀번호 확인</span><input aria-label="비밀번호 확인" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} maxLength={128} autoComplete="new-password" required placeholder="비밀번호를 다시 입력하세요" /></label> : null}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? "처리 중…" : mode === "login" ? "로그인" : "회원가입 신청"}</button>
          </form>
          <div className="auth-switch"><span>{mode === "login" ? "계정이 없으신가요?" : "이미 승인된 계정이 있나요?"}</span><button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setNotice(""); }}>{mode === "login" ? "회원가입 신청" : "로그인으로 돌아가기"}</button></div>
          <nav className="auth-policy-links" aria-label="서비스 정책과 도움말">
            <Link href="/privacy">개인정보 처리방침</Link>
            <Link href="/terms">이용약관</Link>
            <Link href="/help">사용자 도움말</Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
