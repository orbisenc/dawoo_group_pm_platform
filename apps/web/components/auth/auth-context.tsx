"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type AuthUser = {
  id: string;
  username: string | null;
  email: string;
  name: string;
  platformRole: "PLATFORM_ADMIN" | "USER";
};

export type PendingRegistration = { id: string; username: string; email: string; name: string; createdAt: string };
export type ApprovedAccount = {
  id: string;
  username: string;
  email: string;
  name: string;
  platformRole: "PLATFORM_ADMIN" | "USER";
  createdAt: string;
  approvedAt: string | null;
};
export type ApprovedAccountsResult = {
  summary: { approvedAccounts: number; administrators: number; users: number };
  items: ApprovedAccount[];
};
type LocalAccount = PendingRegistration & {
  passwordHash: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  platformRole: "PLATFORM_ADMIN" | "USER";
  approvedAt?: string | null;
  approvedById?: string | null;
  systemAccount?: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (input: { name: string; username: string; email: string; password: string }) => Promise<string>;
  logout: () => void;
  authorizedFetch: (path: string, options?: RequestInit) => Promise<Response>;
  listRegistrations: () => Promise<PendingRegistration[]>;
  decideRegistration: (userId: string, decision: "approve" | "reject") => Promise<void>;
  listApprovedAccounts: () => Promise<ApprovedAccountsResult>;
  updateAccountRole: (userId: string, platformRole: "PLATFORM_ADMIN" | "USER") => Promise<void>;
};

const tokenStorageKey = "project-hub-access-token";
const userStorageKey = "project-hub-session-user";
const accountsStorageKey = "project-hub-local-accounts";
const localAdminHash = "96cae35ce8a9b0244178bf28e4966c2ce1b8385723a96a6b838858cdd6ca0a1e";
const AuthContext = createContext<AuthContextValue | null>(null);

function testAuthEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH === "true";
}

async function errorMessage(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
  if (Array.isArray(body?.message)) return body.message.join(" ");
  return body?.message ?? "요청을 처리하지 못했습니다.";
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readLocalAccounts(): LocalAccount[] {
  const stored = window.localStorage.getItem(accountsStorageKey);
  const accounts = stored ? JSON.parse(stored) as LocalAccount[] : [];
  if (!accounts.some((account) => account.username === "dawooadmin")) {
    accounts.unshift({ id: "local-admin", username: "dawooadmin", email: "admin@projecthub.local", name: "다우그룹 관리자", passwordHash: localAdminHash, approvalStatus: "APPROVED", platformRole: "PLATFORM_ADMIN", createdAt: new Date(0).toISOString(), approvedAt: null, approvedById: null, systemAccount: true });
    window.localStorage.setItem(accountsStorageKey, JSON.stringify(accounts));
  }
  return accounts;
}

function saveLocalAccounts(accounts: LocalAccount[]) {
  window.localStorage.setItem(accountsStorageKey, JSON.stringify(accounts));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = window.sessionStorage.getItem(tokenStorageKey);
    if (!storedToken) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    if (storedToken.startsWith("local:")) {
      const storedUser = window.sessionStorage.getItem(userStorageKey);
      if (storedUser) {
        queueMicrotask(() => {
          setToken(storedToken);
          setUser(JSON.parse(storedUser) as AuthUser);
          setLoading(false);
        });
        return;
      }
    }
    void fetch("/backend/auth/me", { headers: { authorization: `Bearer ${storedToken}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setToken(storedToken);
        setUser(await response.json() as AuthUser);
      })
      .catch(() => window.sessionStorage.removeItem(tokenStorageKey))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    if (testAuthEnabled()) {
      const account = readLocalAccounts().find((item) => item.username === username.trim().toLowerCase());
      if (!account || account.passwordHash !== await sha256(password)) throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
      if (account.approvalStatus === "PENDING") throw new Error("관리자 승인 대기 중인 계정입니다.");
      if (account.approvalStatus === "REJECTED") throw new Error("회원가입 신청이 승인되지 않았습니다.");
      const localUser: AuthUser = { id: account.id, username: account.username, email: account.email, name: account.name, platformRole: account.platformRole };
      const localToken = `local:${account.id}`;
      window.sessionStorage.setItem(tokenStorageKey, localToken);
      window.sessionStorage.setItem(userStorageKey, JSON.stringify(localUser));
      setToken(localToken);
      setUser(localUser);
      return;
    }
    try {
      const response = await fetch("/backend/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (response.status >= 500) throw new TypeError("API unavailable");
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { accessToken: string; user: AuthUser };
      window.sessionStorage.setItem(tokenStorageKey, result.accessToken);
      window.sessionStorage.setItem(userStorageKey, JSON.stringify(result.user));
      setToken(result.accessToken);
      setUser(result.user);
    } catch (reason) {
      if (!(reason instanceof TypeError)) throw reason;
      const account = readLocalAccounts().find((item) => item.username === username.trim().toLowerCase());
      if (!account || account.passwordHash !== await sha256(password)) throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
      if (account.approvalStatus === "PENDING") throw new Error("관리자 승인 대기 중인 계정입니다.");
      if (account.approvalStatus === "REJECTED") throw new Error("회원가입 신청이 승인되지 않았습니다.");
      const localUser: AuthUser = { id: account.id, username: account.username, email: account.email, name: account.name, platformRole: account.platformRole };
      const localToken = `local:${account.id}`;
      window.sessionStorage.setItem(tokenStorageKey, localToken);
      window.sessionStorage.setItem(userStorageKey, JSON.stringify(localUser));
      setToken(localToken);
      setUser(localUser);
    }
  }, []);

  const register = useCallback(async (input: { name: string; username: string; email: string; password: string }) => {
    if (testAuthEnabled()) {
      const accounts = readLocalAccounts();
      const username = input.username.trim().toLowerCase();
      const email = input.email.trim().toLowerCase();
      if (accounts.some((account) => account.username === username || account.email === email)) throw new Error("이미 사용 중인 아이디 또는 이메일입니다.");
      accounts.push({ id: `local-${crypto.randomUUID()}`, username, email, name: input.name.trim(), passwordHash: await sha256(input.password), approvalStatus: "PENDING", platformRole: "USER", createdAt: new Date().toISOString() });
      saveLocalAccounts(accounts);
      return "회원가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.";
    }
    try {
      const response = await fetch("/backend/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (response.status >= 500) throw new TypeError("API unavailable");
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { message: string };
      return result.message;
    } catch (reason) {
      if (!(reason instanceof TypeError)) throw reason;
      const accounts = readLocalAccounts();
      const username = input.username.trim().toLowerCase();
      const email = input.email.trim().toLowerCase();
      if (accounts.some((account) => account.username === username || account.email === email)) throw new Error("이미 사용 중인 아이디 또는 이메일입니다.");
      accounts.push({ id: `local-${crypto.randomUUID()}`, username, email, name: input.name.trim(), passwordHash: await sha256(input.password), approvalStatus: "PENDING", platformRole: "USER", createdAt: new Date().toISOString() });
      saveLocalAccounts(accounts);
      return "회원가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.";
    }
  }, []);

  const logout = useCallback(() => {
    window.sessionStorage.removeItem(tokenStorageKey);
    window.sessionStorage.removeItem(userStorageKey);
    setToken(null);
    setUser(null);
  }, []);

  const authorizedFetch = useCallback((path: string, options?: RequestInit) => {
    if (!token) return Promise.reject(new Error("로그인이 필요합니다."));
    return fetch(`/backend${path}`, {
      ...options,
      headers: { ...options?.headers, authorization: `Bearer ${token}` },
    });
  }, [token]);

  const listRegistrations = useCallback(async () => {
    if (token?.startsWith("local:")) return readLocalAccounts().filter((account) => account.approvalStatus === "PENDING").map(({ id, username, email, name, createdAt }) => ({ id, username, email, name, createdAt }));
    const response = await authorizedFetch("/auth/registrations");
    if (!response.ok) throw new Error(await errorMessage(response));
    return response.json() as Promise<PendingRegistration[]>;
  }, [authorizedFetch, token]);

  const decideRegistration = useCallback(async (userId: string, decision: "approve" | "reject") => {
    if (token?.startsWith("local:")) {
      const decidedAt = new Date().toISOString();
      saveLocalAccounts(readLocalAccounts().map((account) => account.id === userId ? {
        ...account,
        approvalStatus: decision === "approve" ? "APPROVED" : "REJECTED",
        approvedAt: decidedAt,
        approvedById: user?.id ?? null,
      } : account));
      return;
    }
    const response = await authorizedFetch(`/auth/registrations/${userId}/${decision}`, { method: "PATCH" });
    if (!response.ok) throw new Error(await errorMessage(response));
  }, [authorizedFetch, token, user?.id]);

  const listApprovedAccounts = useCallback(async () => {
    if (token?.startsWith("local:")) {
      const items = readLocalAccounts()
        .filter((account) => account.approvalStatus === "APPROVED" && !account.systemAccount && account.id !== "local-admin")
        .map(({ id, username, email, name, platformRole, createdAt, approvedAt }) => ({
          id,
          username,
          email,
          name,
          platformRole,
          createdAt,
          approvedAt: approvedAt ?? null,
        }));
      const administrators = items.filter((account) => account.platformRole === "PLATFORM_ADMIN").length;
      return {
        summary: { approvedAccounts: items.length, administrators, users: items.length - administrators },
        items,
      };
    }
    const response = await authorizedFetch("/auth/accounts");
    if (!response.ok) throw new Error(await errorMessage(response));
    return response.json() as Promise<ApprovedAccountsResult>;
  }, [authorizedFetch, token]);

  const updateAccountRole = useCallback(async (userId: string, platformRole: "PLATFORM_ADMIN" | "USER") => {
    if (token?.startsWith("local:")) {
      saveLocalAccounts(readLocalAccounts().map((account) => account.id === userId ? { ...account, platformRole } : account));
      return;
    }
    const response = await authorizedFetch(`/auth/accounts/${userId}/role`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ platformRole }),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
  }, [authorizedFetch, token]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    loading,
    isAdmin: user?.platformRole === "PLATFORM_ADMIN",
    login,
    register,
    logout,
    authorizedFetch,
    listRegistrations,
    decideRegistration,
    listApprovedAccounts,
    updateAccountRole,
  }), [authorizedFetch, decideRegistration, listApprovedAccounts, listRegistrations, loading, login, logout, register, token, updateAccountRole, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider 안에서 useAuth를 사용해야 합니다.");
  return value;
}

export function useOptionalAuth() {
  return useContext(AuthContext);
}
