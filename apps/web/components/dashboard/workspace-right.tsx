"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BuildingPreview } from "./building-preview";
import { useProject } from "./project-context";

const folders = [
  "01_사업관리",
  "02_설계도서",
  "03_BIM 모델",
  "04_현장사진",
  "05_계약·결재",
];
const approvals = [
  ["검토 중", "커튼월 업체 선정 품의", "2/4"],
  ["승인 대기", "구조 보강공사 변경계약", "1/3"],
  ["승인 대기", "10월 기성금 지급 요청", "0/2"],
  ["승인 완료", "가설울타리 설치 검측", "완료"],
];
const teamupCalendarUrl = "https://teamup.com/ks27cco3hv5g1ove7k";
const teamupEmbedUrl = `${teamupCalendarUrl}?view=m&showHeader=0&showProfileAndInfo=0&showSidepanel=0&disableSidepanel=1&showViewSelector=0&showMenu=0&showDateControls=1&lang=ko&tz=Asia%2FSeoul`;

export function WorkspaceRight() {
  const { selectedProject } = useProject();
  const [selectedFolder, setSelectedFolder] = useState("02_설계도서");
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  useEffect(() => {
    if (!isCalendarExpanded) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsCalendarExpanded(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isCalendarExpanded]);

  return (
    <section className="workspace-right">
      <div className="bim-viewer-card">
        <div className="bim-toolbar">
          <strong>{selectedProject.name} · BIM 통합 모델 미리보기</strong>
          <Link href="/viewer">인터랙티브 뷰어 열기</Link>
          <div>
            <b>DEMO</b>
            <span>고해상도 샘플</span>
          </div>
        </div>
        <Link
          className="dashboard-viewer-preview"
          href="/viewer"
          aria-label="3D 데모 모델 뷰어로 이동"
        >
          <BuildingPreview compact />
        </Link>
      </div>
      <div className="right-widgets">
        <section className="mini-panel shared-files">
          <div className="mini-heading">
            <h3>공유 파일</h3>
            <Link href="/drive">전체보기 ›</Link>
          </div>
          <div className="folder-root">📁 {selectedProject.name}</div>
          {folders.map((folder) => (
            <button
              type="button"
              onClick={() => setSelectedFolder(folder)}
              className={
                selectedFolder === folder ? "folder-row active" : "folder-row"
              }
              key={folder}
            >
              └─ 📁 {folder}
            </button>
          ))}
          <div className="mini-file">
            <b>DWG</b>
            <span>
              <strong>A-201_기준층평면도.dwg</strong>
              <small>24.8 MB · 2026.10.28</small>
            </span>
          </div>
          <div className="mini-file pdf">
            <b>PDF</b>
            <span>
              <strong>10월 공정회의록.pdf</strong>
              <small>3.2 MB · 2026.10.27</small>
            </span>
          </div>
        </section>
        {isCalendarExpanded ? (
          <button
            type="button"
            className="teamup-calendar-backdrop"
            aria-label="확대된 주요 일정 닫기"
            onClick={() => setIsCalendarExpanded(false)}
          />
        ) : null}
        <section
          className={`mini-panel mini-calendar teamup-calendar${
            isCalendarExpanded ? " is-expanded" : ""
          }`}
        >
          <div className="mini-heading">
            <h3>주요 일정</h3>
            <button
              type="button"
              aria-expanded={isCalendarExpanded}
              aria-controls="teamup-main-calendar"
              onClick={() => setIsCalendarExpanded((expanded) => !expanded)}
            >
              {isCalendarExpanded ? "↙ 원래 크기" : "⛶ 크게 보기"}
            </button>
          </div>
          <div className="teamup-calendar-viewport">
            <iframe
              id="teamup-main-calendar"
              className="teamup-calendar-frame"
              src={teamupEmbedUrl}
              title={`${selectedProject.name} Teamup 주요 일정`}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </section>
        <section className="mini-panel mini-approvals">
          <div className="mini-heading">
            <h3>승인 대기</h3>
            <Link href="/approvals">전체보기 ›</Link>
          </div>
          {approvals.map((item, index) => (
            <Link href="/approvals" className="mini-approval" key={item[1]}>
              <span>▧</span>
              <div>
                <b
                  className={
                    index === 0 ? "review" : index === 3 ? "done" : "waiting"
                  }
                >
                  {item[0]}
                </b>
                <strong>{item[1]}</strong>
                <small>김지훈　·　{item[2]}</small>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </section>
  );
}
