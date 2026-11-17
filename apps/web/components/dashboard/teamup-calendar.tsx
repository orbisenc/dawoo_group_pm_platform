"use client";

import { useEffect, useId, useState } from "react";

import { useProject } from "./project-context";

export const teamupCalendarUrl = "https://teamup.com/ks27cco3hv5g1ove7k";
export const teamupEmbedUrl = `${teamupCalendarUrl}?view=m&showHeader=0&showProfileAndInfo=0&showSidepanel=0&disableSidepanel=1&showViewSelector=0&showMenu=0&showDateControls=1&lang=ko&tz=Asia%2FSeoul`;

export function TeamupCalendar({ page = false }: { page?: boolean }) {
  const { selectedProject } = useProject();
  const calendarId = useId();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpanded(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isExpanded]);

  return (
    <>
      {isExpanded ? (
        <button
          type="button"
          className="teamup-calendar-backdrop"
          aria-label="확대된 주요 일정 닫기"
          onClick={() => setIsExpanded(false)}
        />
      ) : null}
      <section
        className={`mini-panel mini-calendar teamup-calendar${
          page ? " teamup-calendar-page" : ""
        }${isExpanded ? " is-expanded" : ""}`}
      >
        <div className="mini-heading">
          <div>
            <h3>주요 일정</h3>
            {page ? <span>{selectedProject.name} Teamup 캘린더</span> : null}
          </div>
          <div className="teamup-calendar-actions">
            {page ? (
              <a href={teamupCalendarUrl} target="_blank" rel="noreferrer">
                Teamup에서 열기
              </a>
            ) : null}
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls={calendarId}
              onClick={() => setIsExpanded((expanded) => !expanded)}
            >
              {isExpanded ? "↙ 원래 크기" : "⛶ 크게 보기"}
            </button>
          </div>
        </div>
        <div className="teamup-calendar-viewport">
          <iframe
            id={calendarId}
            className="teamup-calendar-frame"
            src={teamupEmbedUrl}
            title={`${selectedProject.name} Teamup 주요 일정`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </section>
    </>
  );
}

export function TeamupCalendarWorkspace() {
  return (
    <div className="teamup-calendar-workspace">
      <header>
        <span className="sample-label">
          <i /> TEAMUP 연동
        </span>
        <h2>프로젝트 주요 일정</h2>
        <p>통합 대시보드와 동일한 Teamup 캘린더를 확인합니다.</p>
      </header>
      <TeamupCalendar page />
    </div>
  );
}
