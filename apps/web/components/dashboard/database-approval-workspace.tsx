"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useOptionalAuth } from "../auth/auth-context";
import { useProject } from "./project-context";
import { notifyNavigationBadgeChange } from "../../lib/navigation-badges";

type Status = "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "WITHDRAWN";
type UserSummary = { id: string; name: string };
type Member = { user: UserSummary; role: string; projectMember?: boolean };
type FileVersion = { id: string; version: number; originalName: string; sha256: string; size: string; mimeType: string };
type FileItem = { id: string; name: string; versions: FileVersion[] };
type Step = { id: string; sequence: number; status: "PENDING" | "ACTIVE" | "APPROVED" | "REJECTED"; comment?: string | null; decidedAt?: string | null; approver: UserSummary };
type Revision = { id: string; revision: number; titleSnapshot: string; contentSnapshot: string; fileNameSnapshot?: string | null; fileVersion?: number | null; fileSha256?: string | null; createdAt: string; steps: Step[] };
type Action = { id: string; type: string; comment?: string | null; createdAt: string; actor: UserSummary };
type ApprovalListItem = { id: string; title: string; content: string; status: Status; currentRevision: number; createdAt: string; updatedAt: string; createdBy: UserSummary; file: { id: string; name: string } | null; revisions: Revision[] };
type ApprovalDetail = ApprovalListItem & { fileVersion: FileVersion | null; routeMembers: Array<{ sequence: number; approver: UserSummary }>; actions: Action[] };
type RouteTemplate = { id: string; name: string; description?: string | null; createdBy: UserSummary; updatedAt: string; members: Array<{ sequence: number; approver: UserSummary }> };
type Scope = "all" | "pending" | "mine";
type MainView = "documents" | "templates";

const localApprovalTemplatesKey = (projectId: string) => `project-hub-local-approval-templates:${projectId}`;

const statusText: Record<Status, string> = { DRAFT: "임시 저장", IN_REVIEW: "결재 중", APPROVED: "승인 완료", REJECTED: "반려", WITHDRAWN: "회수" };
const stepText: Record<Step["status"], string> = { PENDING: "대기", ACTIVE: "결재 요청", APPROVED: "승인", REJECTED: "반려" };
const actionText: Record<string, string> = { CREATED: "기안", UPDATED: "수정", SUBMITTED: "상신", RESUBMITTED: "재상신", APPROVED: "승인", REJECTED: "반려", WITHDRAWN: "회수" };

function readLocalTemplates(projectId: string): RouteTemplate[] {
  try {
    const stored = window.localStorage.getItem(localApprovalTemplatesKey(projectId));
    if (!stored) return [];
    const templates = JSON.parse(stored) as RouteTemplate[];
    return Array.isArray(templates) ? templates : [];
  } catch {
    return [];
  }
}

function writeLocalTemplates(projectId: string, templates: RouteTemplate[]) {
  window.localStorage.setItem(localApprovalTemplatesKey(projectId), JSON.stringify(templates));
}

async function api<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/backend${path}`, { ...options, headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...options?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
    throw new Error(Array.isArray(body?.message) ? body.message.join(" ") : body?.message ?? "요청을 처리하지 못했습니다.");
  }
  return response.json() as Promise<T>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function shortHash(value: string) { return `${value.slice(0, 12)}…${value.slice(-8)}`; }

function RouteEditor({ members, approverIds, onChange }: { members: Member[]; approverIds: string[]; onChange(ids: string[]): void }) {
  const [candidate, setCandidate] = useState("");
  const available = members.filter((member) => !approverIds.includes(member.user.id));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= approverIds.length) return;
    const next = [...approverIds];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };
  const replace = (index: number, approverId: string) => {
    const next = [...approverIds];
    next[index] = approverId;
    onChange(next);
  };

  return (
    <fieldset className="approval-route-editor">
      <legend>순차 결재선</legend>
      <div className="approval-route-guide">
        <div><strong>결재 순서와 담당자</strong><span>왼쪽부터 차례대로 승인 요청이 전달됩니다.</span></div>
        <span>승인 완료 회원 {members.length}명</span>
      </div>
      <div className="approval-route-add">
        <label>
          다음 결재 담당자
          <select aria-label="결재자 선택" value={candidate} onChange={(event) => setCandidate(event.target.value)}>
            <option value="">결재자를 선택하세요</option>
            {available.map((member) => <option value={member.user.id} key={member.user.id}>{member.user.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={!candidate} onClick={() => { onChange([...approverIds, candidate]); setCandidate(""); }}>+ 결재 단계 추가</button>
      </div>
      {approverIds.length === 0 ? <div className="approval-route-empty"><strong>아직 결재 단계가 없습니다.</strong><span>승인 완료 회원을 선택해 첫 번째 결재 단계를 추가해 주세요.</span></div> : null}
      <ol className="approval-route-flow">
        {approverIds.map((id, index) => {
          const member = members.find((item) => item.user.id === id);
          if (!member) return null;
          const choices = members.filter((item) => item.user.id === id || !approverIds.includes(item.user.id));
          return (
            <li className="approval-route-node" key={id}>
              <div className="approval-route-card">
                <header><b>{index + 1}</b><span><strong>{index + 1}차 결재</strong><small>{index === 0 ? "최초 검토" : "앞 단계 승인 후 요청"}</small></span></header>
                <label>
                  담당자
                  <select aria-label={`${index + 1}차 결재 담당자`} value={id} onChange={(event) => replace(index, event.target.value)}>
                    {choices.map((choice) => <option value={choice.user.id} key={choice.user.id}>{choice.user.name}</option>)}
                  </select>
                </label>
                <div className="approval-route-node-actions">
                  <button type="button" aria-label={`${member.user.name} 결재 순서를 앞으로 이동`} disabled={index === 0} onClick={() => move(index, -1)}>← 앞으로</button>
                  <button type="button" aria-label={`${member.user.name} 결재 순서를 뒤로 이동`} disabled={index === approverIds.length - 1} onClick={() => move(index, 1)}>뒤로 →</button>
                  <button className="danger" type="button" aria-label={`${member.user.name} 결재선에서 제거`} onClick={() => onChange(approverIds.filter((item) => item !== id))}>제거</button>
                </div>
              </div>
              {index < approverIds.length - 1 ? <span className="approval-route-connector" aria-hidden="true">→</span> : null}
            </li>
          );
        })}
      </ol>
    </fieldset>
  );
}

export function DatabaseApprovalWorkspace() {
  const auth = useOptionalAuth();
  const { selectedProject } = useProject();
  const projectId = selectedProject.id;
  const [token, setToken] = useState("");
  const [me, setMe] = useState<UserSummary | null>(null);
  const [items, setItems] = useState<ApprovalListItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<ApprovalDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [templates, setTemplates] = useState<RouteTemplate[]>([]);
  const [view, setView] = useState<MainView>("documents");
  const [scope, setScope] = useState<Scope>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [comment, setComment] = useState("");
  const [documentForm, setDocumentForm] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fileId, setFileId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [documentApproverIds, setDocumentApproverIds] = useState<string[]>([]);
  const [templateForm, setTemplateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateApproverIds, setTemplateApproverIds] = useState<string[]>([]);

  const selectedFile = files.find((file) => file.id === fileId);
  const filtered = useMemo(() => items.filter((item) => scope === "all" || scope === "mine" && item.createdBy.id === me?.id || scope === "pending" && item.revisions[0]?.steps.some((step) => step.status === "ACTIVE" && step.approver.id === me?.id)), [items, me?.id, scope]);

  const loadAll = useCallback(async (accessToken: string) => {
    if (accessToken.startsWith("local:") && auth) {
      const accounts = await auth.listApprovedAccounts();
      setItems([]);
      setFiles([]);
      setMembers(accounts.items.map((account) => ({
        user: { id: account.id, name: account.name },
        role: account.platformRole,
        projectMember: false,
      })));
      const localTemplates = readLocalTemplates(projectId);
      setTemplates(localTemplates);
      setSelectedId("");
      return;
    }
    const [list, context, routeTemplates] = await Promise.all([
      api<{ items: ApprovalListItem[] }>(`/projects/${projectId}/approvals?scope=all`, accessToken),
      api<{ files: FileItem[]; members: Member[] }>(`/projects/${projectId}/approvals/context`, accessToken),
      api<RouteTemplate[]>(`/projects/${projectId}/approvals/route-templates`, accessToken),
    ]);
    setItems(list.items); setFiles(context.files); setMembers(context.members); setTemplates(routeTemplates);
    setSelectedId((current) => list.items.some((item) => item.id === current) ? current : list.items[0]?.id ?? "");
  }, [auth, projectId]);

  const loadDetail = useCallback(async (accessToken: string, documentId: string) => {
    if (!documentId) { setSelected(null); return; }
    setSelected(await api<ApprovalDetail>(`/projects/${projectId}/approvals/${documentId}`, accessToken));
  }, [projectId]);

  useEffect(() => {
    if (auth?.loading) return;
    let active = true;
    void (async () => {
      setLoading(true); setError("");
      try {
        let accessToken = auth?.token ?? "";
        let currentUser = auth?.user ? { id: auth.user.id, name: auth.user.name } : null;
        if (!accessToken) {
          const response = await fetch("/backend/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "partner@projecthub.local" }) });
          if (!response.ok) throw new Error("로그인 후 결재 기능을 이용해 주세요.");
          const session = await response.json() as { accessToken: string; user: UserSummary };
          accessToken = session.accessToken; currentUser = session.user;
        }
        if (!active) return;
        setToken(accessToken); setMe(currentUser); await loadAll(accessToken);
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "결재 데이터를 불러오지 못했습니다."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [auth?.loading, auth?.token, auth?.user, loadAll]);

  useEffect(() => {
    if (!token || !selectedId) return;
    let active = true;
    void api<ApprovalDetail>(`/projects/${projectId}/approvals/${selectedId}`, token)
      .then((document) => { if (active) setSelected(document); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "결재 상세를 불러오지 못했습니다."); });
    return () => { active = false; };
  }, [projectId, selectedId, token]);

  const refresh = async (documentId = selectedId) => { await loadAll(token); if (documentId) await loadDetail(token, documentId); };
  const closeDocumentForm = () => { setDocumentForm(false); setEditingDocumentId(""); setTitle(""); setContent(""); setFileId(""); setVersionId(""); setTemplateId(""); setDocumentApproverIds([]); };
  const openDocumentCreate = () => {
    setError("");
    if (templates.length === 0) { setView("templates"); setNotice("먼저 재사용할 결재선 템플릿을 만들어 주세요."); setTemplateForm(true); return; }
    const route = templates[0]!;
    setEditingDocumentId(""); setTitle(""); setContent(""); setFileId(""); setVersionId(""); setTemplateId(route.id); setDocumentApproverIds(route.members.map((member) => member.approver.id)); setDocumentForm(true);
  };
  const openDocumentEdit = (document: ApprovalDetail) => { setEditingDocumentId(document.id); setTitle(document.title); setContent(document.content); setFileId(document.file?.id ?? ""); setVersionId(document.fileVersion?.id ?? ""); setTemplateId(""); setDocumentApproverIds(document.routeMembers.map((member) => member.approver.id)); setDocumentForm(true); };
  const applyTemplate = (id: string) => { setTemplateId(id); setDocumentApproverIds(templates.find((item) => item.id === id)?.members.map((member) => member.approver.id) ?? []); };

  const saveDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (documentApproverIds.length === 0) { setError("결재선 템플릿을 선택해 주세요."); return; }
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const submitNow = submitter?.value === "submit";
    setBusy(true); setError(""); setNotice("");
    try {
      const body: Record<string, unknown> = { title, content, approverIds: documentApproverIds };
      if (fileId && versionId) { body.fileId = fileId; body.fileVersionId = versionId; }
      const saved = await api<ApprovalDetail>(`/projects/${projectId}/approvals${editingDocumentId ? `/${editingDocumentId}` : ""}`, token, { method: editingDocumentId ? "PATCH" : "POST", body: JSON.stringify(body) });
      if (submitNow) await api(`/projects/${projectId}/approvals/${saved.id}/submit`, token, { method: "POST" });
      closeDocumentForm(); setSelectedId(saved.id); setNotice(submitNow ? "결재 문서를 상신했습니다." : "결재 문서를 임시 저장했습니다."); await refresh(saved.id); notifyNavigationBadgeChange("approvals");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "결재 문서를 저장하지 못했습니다."); }
    finally { setBusy(false); }
  };

  const submitDocument = async (document: ApprovalDetail) => { setBusy(true); setError(""); try { await api(`/projects/${projectId}/approvals/${document.id}/submit`, token, { method: "POST" }); setNotice("결재 문서를 상신했습니다."); await refresh(document.id); notifyNavigationBadgeChange("approvals"); } catch (reason) { setError(reason instanceof Error ? reason.message : "결재 문서를 상신하지 못했습니다."); } finally { setBusy(false); } };
  const decide = async (decision: "approve" | "reject") => {
    if (!selected) return;
    if (decision === "reject" && !comment.trim()) { setError("반려 사유를 입력해 주세요."); return; }
    setBusy(true); setError("");
    try { await api(`/projects/${projectId}/approvals/${selected.id}/${decision}`, token, { method: "POST", body: JSON.stringify({ comment }) }); setComment(""); setNotice(decision === "approve" ? "현재 결재 단계를 승인했습니다." : "결재 문서를 반려했습니다."); await refresh(selected.id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "결재를 처리하지 못했습니다."); }
    finally { setBusy(false); }
  };
  const withdraw = async (document: ApprovalDetail) => {
    if (!window.confirm("첫 승인 전 결재 문서를 회수하시겠습니까?")) return;
    setBusy(true); setError("");
    try { await api(`/projects/${projectId}/approvals/${document.id}/withdraw`, token, { method: "POST" }); setNotice("결재 문서를 회수했습니다."); await refresh(document.id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "결재 문서를 회수하지 못했습니다."); }
    finally { setBusy(false); }
  };

  const closeTemplateForm = () => { setTemplateForm(false); setEditingTemplateId(""); setTemplateName(""); setTemplateDescription(""); setTemplateApproverIds([]); };
  const openTemplateEdit = (template: RouteTemplate) => { setEditingTemplateId(template.id); setTemplateName(template.name); setTemplateDescription(template.description ?? ""); setTemplateApproverIds(template.members.map((member) => member.approver.id)); setTemplateForm(true); };
  const saveTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (templateApproverIds.length === 0) { setError("결재자를 한 명 이상 추가해 주세요."); return; }
    const editing = Boolean(editingTemplateId);
    setBusy(true); setError("");
    try {
      if (token.startsWith("local:")) {
        if (!me) throw new Error("로그인 정보를 확인할 수 없습니다.");
        const routeMembers = templateApproverIds.map((approverId, index) => {
          const member = members.find((item) => item.user.id === approverId);
          if (!member) throw new Error("승인 완료된 결재자 정보를 다시 확인해 주세요.");
          return { sequence: index + 1, approver: member.user };
        });
        const now = new Date().toISOString();
        const current = readLocalTemplates(projectId);
        const nextTemplate: RouteTemplate = {
          id: editingTemplateId || `local-template-${crypto.randomUUID()}`,
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          createdBy: me,
          updatedAt: now,
          members: routeMembers,
        };
        writeLocalTemplates(projectId, editing
          ? current.map((template) => template.id === editingTemplateId ? { ...template, ...nextTemplate, createdBy: template.createdBy } : template)
          : [nextTemplate, ...current]);
      } else {
        await api(`/projects/${projectId}/approvals/route-templates${editingTemplateId ? `/${editingTemplateId}` : ""}`, token, { method: editingTemplateId ? "PATCH" : "POST", body: JSON.stringify({ name: templateName, description: templateDescription, approverIds: templateApproverIds }) });
      }
      closeTemplateForm(); setNotice(editing ? "결재선 템플릿을 수정했습니다." : "결재선 템플릿을 만들었습니다."); await loadAll(token);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "결재선 템플릿을 저장하지 못했습니다."); }
    finally { setBusy(false); }
  };
  const deleteTemplate = async (template: RouteTemplate) => {
    if (!window.confirm(`'${template.name}' 결재선 템플릿을 삭제하시겠습니까?`)) return;
    setBusy(true); setError("");
    try {
      if (token.startsWith("local:")) {
        writeLocalTemplates(projectId, readLocalTemplates(projectId).filter((item) => item.id !== template.id));
      } else {
        await api(`/projects/${projectId}/approvals/route-templates/${template.id}`, token, { method: "DELETE" });
      }
      setNotice("결재선 템플릿을 삭제했습니다."); await loadAll(token);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "결재선 템플릿을 삭제하지 못했습니다."); }
    finally { setBusy(false); }
  };

  const latestRevision = selected?.revisions[0];
  const activeStep = latestRevision?.steps.find((step) => step.status === "ACTIVE");
  const canDecide = selected?.status === "IN_REVIEW" && activeStep?.approver.id === me?.id;
  const canEdit = selected && selected.createdBy.id === me?.id && ["DRAFT", "REJECTED", "WITHDRAWN"].includes(selected.status);
  const canWithdraw = selected?.status === "IN_REVIEW" && selected.createdBy.id === me?.id && !latestRevision?.steps.some((step) => step.status === "APPROVED" || step.status === "REJECTED");

  return <section className="approval-system">
    <header className="approval-title"><div><span className="sample-label"><i /> 실제 결재 데이터</span><h2>전자결재</h2><p>{selectedProject.name}의 기안, 순차 승인과 결재선 템플릿을 관리합니다.</p></div><span className="approval-mode">API · 권한 · 감사 이력 연결</span></header>
    <nav className="approval-main-tabs" aria-label="전자결재 업무 구분"><button className={view === "documents" ? "active" : ""} type="button" onClick={() => setView("documents")}><strong>결재 문서</strong><span>기안·상신·승인·반려</span></button><button className={view === "templates" ? "active" : ""} type="button" onClick={() => setView("templates")}><strong>결재선 템플릿</strong><span>결재 순서 저장·재사용</span></button></nav>
    {notice ? <div className="approval-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")}>닫기</button></div> : null}
    {error ? <div className="db-feed-error" role="alert">{error}</div> : null}

    {view === "documents" ? <>
      <div className="approval-toolbar"><div className="approval-tabs" aria-label="결재 문서 필터">{([['all', '전체'], ['pending', '내 결재 대기'], ['mine', '내가 기안']] as const).map(([value, label]) => <button className={scope === value ? "active" : ""} type="button" onClick={() => setScope(value)} key={value}>{label}</button>)}</div><button className="primary-button" type="button" onClick={openDocumentCreate}>새 결재 작성</button></div>
      {documentForm ? <form className="approval-composer approval-document-form" onSubmit={saveDocument}><header><div><span>결재 문서</span><h3>{editingDocumentId ? "결재 문서 수정" : "새 결재 작성"}</h3></div><button type="button" onClick={closeDocumentForm}>닫기</button></header>{!editingDocumentId ? <label>결재선 템플릿<select required value={templateId} onChange={(event) => applyTemplate(event.target.value)}><option value="">템플릿을 선택하세요</option>{templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}</select></label> : null}<label>제목<input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="결재 제목을 입력하세요" /></label><label>결재 내용<textarea required maxLength={10000} value={content} onChange={(event) => setContent(event.target.value)} placeholder="검토할 내용과 요청 사항을 구체적으로 작성하세요" /></label><div className="approval-form-grid"><label>첨부파일 (선택)<select value={fileId} onChange={(event) => { const nextId = event.target.value; setFileId(nextId); setVersionId(files.find((file) => file.id === nextId)?.versions[0]?.id ?? ""); }}><option value="">첨부하지 않음</option>{files.map((file) => <option value={file.id} key={file.id}>{file.name}</option>)}</select></label><label>파일 버전<select disabled={!selectedFile} value={versionId} onChange={(event) => setVersionId(event.target.value)}><option value="">버전 선택</option>{selectedFile?.versions.map((version) => <option value={version.id} key={version.id}>v{version.version} · {version.originalName}</option>)}</select></label></div><RouteEditor members={members} approverIds={documentApproverIds} onChange={setDocumentApproverIds} /><div className="approval-form-actions"><button type="submit" value="draft" disabled={busy}>임시 저장</button><button className="primary-button" type="submit" value="submit" disabled={busy}>{busy ? "처리 중…" : "저장 후 상신"}</button></div></form> : null}
      <div className="approval-workspace"><section className="approval-table approval-document-list" aria-busy={loading}><div className="approval-list-head"><span>상태</span><span>문서</span><span>기안자</span><span>현재 단계</span><span>수정일</span></div>{loading ? <div className="approval-empty"><strong>결재 문서를 불러오는 중입니다.</strong></div> : null}{!loading && filtered.length === 0 ? <div className="approval-empty"><strong>표시할 결재 문서가 없습니다.</strong><span>새 결재 작성에서 실제 업무 문서를 기안해 주세요.</span></div> : null}{filtered.map((item) => { const revision = item.revisions[0]; const active = revision?.steps.find((step) => step.status === "ACTIVE"); return <button className={`approval-list-row${selectedId === item.id ? " selected" : ""}`} type="button" onClick={() => setSelectedId(item.id)} key={item.id}><span><b className={`approval-state state-${item.status}`}>{statusText[item.status]}</b></span><span><strong>{item.title}</strong><small>{item.file?.name ?? "첨부파일 없음"}</small></span><span>{item.createdBy.name}</span><span>{active ? `${active.sequence}단계 · ${active.approver.name}` : item.status === "APPROVED" ? "완료" : "-"}</span><time>{formatDate(item.updatedAt)}</time></button>; })}</section>
        <aside className="approval-detail">{!selected ? <div className="approval-empty"><strong>결재 문서를 선택해 주세요.</strong></div> : <><div className="approval-detail-head"><span className={`approval-state state-${selected.status}`}>{statusText[selected.status]}</span><div>{canEdit ? <button type="button" onClick={() => openDocumentEdit(selected)}>수정</button> : null}{canEdit ? <button type="button" disabled={busy} onClick={() => void submitDocument(selected)}>{selected.status === "DRAFT" ? "상신" : "재상신"}</button> : null}{canWithdraw ? <button type="button" disabled={busy} onClick={() => void withdraw(selected)}>회수</button> : null}</div></div><h3>{selected.title}</h3><small>{selected.createdBy.name} 기안 · {formatDate(selected.createdAt)}</small><p>{selected.content}</p>{selected.fileVersion ? <div className="approval-file-lock"><b>고정된 첨부 버전</b><strong>{selected.file?.name} · v{selected.fileVersion.version}</strong><code>{shortHash(selected.fileVersion.sha256)}</code><small>상신 후 파일 버전과 SHA-256 해시는 변경되지 않습니다.</small></div> : <div className="approval-file-lock no-file"><b>첨부파일 없음</b><small>본문만으로 진행하는 결재 문서입니다.</small></div>}<h4>결재선</h4><ol className="approval-steps">{(latestRevision?.steps ?? selected.routeMembers.map((route) => ({ id: `${selected.id}-${route.sequence}`, sequence: route.sequence, status: "PENDING" as const, comment: null, approver: route.approver }))).map((step) => <li className={step.status.toLowerCase()} key={step.id}><i>{step.status === "APPROVED" ? "✓" : step.status === "REJECTED" ? "!" : step.sequence}</i><span><strong>{step.approver.name}</strong><small>{stepText[step.status]}{step.comment ? ` · ${step.comment}` : ""}</small></span></li>)}</ol>{canDecide ? <div className="approval-decision"><label>결재 의견<textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} placeholder="승인 의견은 선택, 반려 사유는 필수입니다." /></label><div className="decision-buttons"><button type="button" disabled={busy} onClick={() => void decide("reject")}>반려</button><button type="button" disabled={busy} onClick={() => void decide("approve")}>승인</button></div></div> : null}<h4>처리 이력</h4><div className="approval-history">{selected.actions.length === 0 ? <p>처리 이력이 없습니다.</p> : selected.actions.map((action) => <p key={action.id}><b>{actionText[action.type] ?? action.type}</b><span>{action.actor.name}{action.comment ? ` · ${action.comment}` : ""}</span><time>{formatDate(action.createdAt)}</time></p>)}</div><div className="approval-scope-note">현재 순번의 지정 결재자만 승인·반려할 수 있으며 모든 처리는 감사 이력에 기록됩니다.</div></>}</aside></div>
    </> : <><div className="approval-toolbar"><div><h3>결재선 템플릿</h3><p>자주 쓰는 순차 결재선을 저장하고 새 결재에 적용합니다.</p></div><button className="primary-button" type="button" onClick={() => { closeTemplateForm(); setTemplateForm(true); }}>새 결재선 만들기</button></div>{templateForm ? <form className="approval-composer approval-template-form" onSubmit={saveTemplate}><header><div><span>결재선 템플릿</span><h3>{editingTemplateId ? "결재선 수정" : "새 결재선 만들기"}</h3></div><button type="button" onClick={closeTemplateForm}>닫기</button></header><label>템플릿 이름<input required maxLength={120} value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="예: 공사비 변경 기본 결재선" /></label><label>설명<textarea maxLength={500} value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} placeholder="이 결재선을 사용하는 업무를 설명하세요" /></label><RouteEditor members={members} approverIds={templateApproverIds} onChange={setTemplateApproverIds} /><div className="approval-form-actions"><button type="button" onClick={closeTemplateForm}>취소</button><button className="primary-button" type="submit" disabled={busy}>{busy ? "저장 중…" : "템플릿 저장"}</button></div></form> : null}<div className="approval-template-grid">{templates.length === 0 ? <div className="approval-empty approval-template-empty"><strong>저장된 결재선 템플릿이 없습니다.</strong><span>새 결재선을 만들어 실제 참여자를 순서대로 지정해 주세요.</span></div> : templates.map((template) => <article className="approval-template-card" key={template.id}><header><div><span>결재자 {template.members.length}명</span><h3>{template.name}</h3></div>{template.createdBy.id === me?.id ? <div><button type="button" onClick={() => openTemplateEdit(template)}>수정</button><button type="button" onClick={() => void deleteTemplate(template)}>삭제</button></div> : null}</header><p>{template.description || "설명 없음"}</p><ol>{template.members.map((member) => <li key={member.approver.id}><b>{member.sequence}</b><span>{member.approver.name}</span></li>)}</ol><footer><span>{template.createdBy.name} 생성</span><time>{formatDate(template.updatedAt)}</time></footer></article>)}</div></>}
  </section>;
}
