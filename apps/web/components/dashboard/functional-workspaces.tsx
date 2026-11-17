"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
export { DatabaseDriveWorkspace as DriveWorkspace } from "./database-drive-workspace";
export { DatabaseCalendarWorkspace as CalendarWorkspace } from "./database-calendar-workspace";
export { DatabaseApprovalWorkspace as ApprovalWorkspace } from "./database-approval-workspace";

type ProjectEvent = { day: number; time: string; title: string; location: string; color: string };
const initialEvents: ProjectEvent[] = [{day:6,time:"10:00",title:"설계 정례회의",location:"온라인",color:"teal"},{day:14,time:"14:00",title:"구조 변경사항 검토",location:"회의실 B",color:"orange"},{day:21,time:"09:30",title:"주간 공정회의",location:"현장 회의실",color:"blue"},{day:28,time:"16:30",title:"인허가 사전협의",location:"용산구청",color:"teal"}];

export function LegacyCalendarWorkspace() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [events, setEvents] = useState(initialEvents);
  const [selectedDay, setSelectedDay] = useState(28);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const month = 10 + monthOffset;
  const addEvent = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!title.trim()) return; setEvents((current) => [...current, { day:selectedDay,time,title:title.trim(),location:"장소 미정",color:"teal" }]); setTitle(""); setFormOpen(false); };
  const dayEvents = events.filter((event) => event.day === selectedDay);
  return <><WorkspaceTitle title="프로젝트 일정" description="회의, 공정, 인허가와 결재 일정을 월간 보기로 확인합니다."><button className="primary-button" onClick={() => setFormOpen((open) => !open)} type="button">+ 일정 등록</button></WorkspaceTitle>{formOpen && <form className="inline-action-form" onSubmit={addEvent}><strong>새 일정</strong><input aria-label="일정 제목" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="일정 제목" required/><input aria-label="일정 시간" type="time" value={time} onChange={(event) => setTime(event.target.value)}/><button type="submit">저장</button><button type="button" onClick={() => setFormOpen(false)}>취소</button></form>}<div className="calendar-layout"><section className="calendar-card"><div className="calendar-top"><button type="button" onClick={() => setMonthOffset((value) => value - 1)}>‹</button><h3>2026년 {month}월</h3><button type="button" onClick={() => setMonthOffset((value) => value + 1)}>›</button><span>오늘</span></div><div className="calendar-week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div className="calendar-days">{Array.from({ length: 35 }, (_, index) => index - 2).map((rawDay,index)=>{const day=rawDay<1?30+rawDay:rawDay>31?rawDay-31:rawDay;const muted=rawDay<1||rawDay>31;const event=events.find((item)=>item.day===day&&!muted);return <button type="button" onClick={()=>!muted&&setSelectedDay(day)} className={`${selectedDay===day&&!muted?"today ":""}${muted?"muted":""}`} key={index}><span>{day}</span>{event&&<i className={`event ${event.color}`}>{event.title}</i>}</button>})}</div></section><aside className="day-agenda"><span>2026년 {month}월 {selectedDay}일</span><h3>선택한 일정 <b>{dayEvents.length}</b></h3>{dayEvents.map((event)=><div className={`agenda-item ${event.color}`} key={`${event.time}-${event.title}`}><time>{event.time}</time><strong>{event.title}</strong><small>{event.location}</small></div>)}{dayEvents.length===0&&<EmptyState text="등록된 일정이 없습니다." />}</aside></div></>;
}

type Approval = { id:string; state:"검토 중"|"결재 대기"|"승인 완료"|"반려"; title:string; author:string; step:string; due:string; description:string };
const initialApprovals: Approval[] = [{id:"APP-2026-104",state:"검토 중",title:"커튼월 업체 선정 품의",author:"김지훈",step:"2 / 3",due:"오늘",description:"커튼월 우선협상대상자 선정 및 계약 추진 승인 요청"},{id:"APP-2026-101",state:"결재 대기",title:"구조 보강공사 변경계약",author:"이수현",step:"1 / 4",due:"D-1",description:"지하층 구조 변경에 따른 추가 공사비 변경계약"},{id:"APP-2026-098",state:"결재 대기",title:"10월 기성금 지급 요청",author:"박민수",step:"3 / 3",due:"D-2",description:"10월 공정률 기준 기성금 지급 승인 요청"},{id:"APP-2026-094",state:"승인 완료",title:"가설울타리 디자인 변경",author:"정하윤",step:"3 / 3",due:"10.25",description:"현장 가설울타리 디자인 변경안"}];

export function LegacyApprovalWorkspace() {
  const [items, setItems] = useState(initialApprovals);
  const [selectedId, setSelectedId] = useState(initialApprovals[0]!.id);
  const [message, setMessage] = useState("");
  const selected = items.find((item) => item.id === selectedId)!;
  const decide = (state: "승인 완료" | "반려") => { setItems((current) => current.map((item) => item.id === selectedId ? {...item,state,step:state==="승인 완료"?"완료":item.step} : item)); setMessage(state === "승인 완료" ? "문서를 승인했습니다." : "문서를 반려했습니다."); };
  return <><WorkspaceTitle title="전자결재" description="상신 문서와 순차 결재 진행 상태를 확인하고 처리합니다."><button className="primary-button" type="button">+ 결재 작성</button></WorkspaceTitle><div className="approval-workspace"><section className="data-panel approval-table"><div className="data-head approval-columns"><span>상태</span><span>문서번호 / 제목</span><span>기안자</span><span>결재 단계</span><span>기한</span></div>{items.map((row)=><button type="button" onClick={()=>{setSelectedId(row.id);setMessage("")}} className={`data-row approval-columns ${selectedId===row.id?"selected":""}`} key={row.id}><span><b className={`approval-state state-${row.state.replace(" ", "-")}`}>{row.state}</b></span><span><small>{row.id}</small><strong>{row.title}</strong></span><span><i className="mini-avatar">{row.author[0]}</i>{row.author}</span><span>{row.step}</span><span>{row.due}　›</span></button>)}</section><aside className="approval-detail"><span className="sample-tag">선택 문서</span><h3>{selected.title}</h3><small>{selected.id} · {selected.author} 기안</small><p>{selected.description}</p><dl><div><dt>현재 상태</dt><dd>{selected.state}</dd></div><div><dt>결재 단계</dt><dd>{selected.step}</dd></div><div><dt>처리 기한</dt><dd>{selected.due}</dd></div></dl><textarea aria-label="결재 의견" placeholder="승인 또는 반려 의견을 입력하세요"/>{message&&<div className="action-message">{message}</div>}<div className="decision-buttons"><button type="button" onClick={()=>decide("반려")}>반려</button><button type="button" onClick={()=>decide("승인 완료")}>승인</button></div></aside></div></>;
}

function WorkspaceTitle({title,description,children}:{title:string;description:string;children:ReactNode}) { return <div className="section-title"><div><span className="sample-label"><i/> 샘플 데이터</span><h2>{title}</h2><p>{description}</p></div>{children}</div>; }
function EmptyState({text}:{text:string}) { return <div className="workspace-empty"><strong>{text}</strong><span>새 항목을 추가하거나 다른 조건을 선택해 주세요.</span></div>; }
