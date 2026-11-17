import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ApprovalWorkspace,
  CalendarWorkspace,
  DriveWorkspace,
} from "./functional-workspaces";
import { ProjectProvider } from "./project-context";

const renderCalendar = () =>
  render(
    <ProjectProvider>
      <CalendarWorkspace />
    </ProjectProvider>,
  );

describe("기능형 업무 화면", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear(),
      },
    });
  });
  it("공유 드라이브에 파일을 추가하고 로컬에 유지한다", async () => {
    render(<DriveWorkspace />);
    await screen.findByText(/로컬 저장 모드/);
    const input = screen.getByLabelText("+ 파일 업로드");
    const file = new File(["sample"], "현장점검사진.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText("100%")).toBeInTheDocument());
    expect(screen.getAllByText("현장점검사진.jpg").length).toBeGreaterThan(0);
    expect(
      window.localStorage.getItem(
        "project-hub:drive:v2:30000000-0000-4000-8000-000000000001",
      ),
    ).toContain("현장점검사진.jpg");
  });

  it("Google Drive 저장소 전환과 OAuth 설정 안내를 제공한다", () => {
    render(<DriveWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Google Drive" }));

    expect(
      screen.getByRole("heading", { name: "Google Drive 연동 준비" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("NEXT_PUBLIC_GOOGLE_CLIENT_ID"),
    ).toBeInTheDocument();
  });

  it("표준 프로젝트 폴더와 그룹 전용 폴더를 제공한다", async () => {
    render(<DriveWorkspace />);
    await screen.findByText(/로컬 저장 모드/);
    for (const name of [
      "01_사업관리",
      "02_토지계약",
      "03_인허가",
      "04_설계도면",
      "05_금융PF",
      "06_계약발주",
      "07_공사공정",
      "08_회의록",
    ])
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "＋ 새 폴더" }));
    fireEvent.change(screen.getByLabelText("새 폴더 이름"), {
      target: { value: "협력사 자료" },
    });
    fireEvent.change(screen.getByLabelText("폴더 접근 그룹"), {
      target: { value: "40000000-0000-4000-8000-000000000001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    await waitFor(() =>
      expect(screen.getAllByText("협력사 자료").length).toBeGreaterThan(0),
    );
    expect(
      window.localStorage.getItem(
        "project-hub:drive:v2:30000000-0000-4000-8000-000000000001",
      ),
    ).toContain("40000000-0000-4000-8000-000000000001");
  });

  it("공유 드라이브에 폴더를 만들고 진입한다", async () => {
    render(<DriveWorkspace />);
    await screen.findByText(/로컬 저장 모드/);
    fireEvent.click(screen.getByRole("button", { name: "＋ 새 폴더" }));
    fireEvent.change(screen.getByLabelText("새 폴더 이름"), {
      target: { value: "06_준공자료" },
    });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    await waitFor(() =>
      expect(screen.getAllByText("06_준공자료").length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByRole("button", { name: /06_준공자료/ })[0]!);
    await waitFor(() =>
      expect(screen.getByText("표시할 파일이 없습니다.")).toBeInTheDocument(),
    );
  });

  it("일정 탭에 통합 대시보드와 같은 Teamup 캘린더를 표시한다", () => {
    renderCalendar();

    expect(
      screen.getByRole("heading", { name: "프로젝트 주요 일정" }),
    ).toBeInTheDocument();
    const calendar = screen.getByTitle(/Teamup 주요 일정/);
    expect(calendar).toHaveAttribute(
      "src",
      expect.stringContaining("teamup.com/ks27cco3hv5g1ove7k"),
    );
    expect(
      screen.getByRole("link", { name: "Teamup에서 열기" }),
    ).toHaveAttribute("href", "https://teamup.com/ks27cco3hv5g1ove7k");
  });

  it("일정 탭의 Teamup 캘린더를 확대하고 복원한다", () => {
    renderCalendar();

    fireEvent.click(screen.getByRole("button", { name: /크게 보기/ }));
    expect(screen.getByRole("button", { name: /원래 크기/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: /원래 크기/ }));
    expect(screen.getByRole("button", { name: /크게 보기/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("선택한 결재 문서를 승인한다", async () => {
    render(<ApprovalWorkspace />);
    expect(
      (await screen.findAllByText("커튼월 업체 선정 품의")).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    await waitFor(() =>
      expect(
        screen.getByText("현재 결재 단계를 승인했습니다."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("이수현")).toBeInTheDocument();
  });

  it("결재 요청을 작성하고 즉시 상신한다", async () => {
    render(<ApprovalWorkspace />);
    await screen.findByText(/로컬 데모 모드/);
    fireEvent.click(screen.getByRole("button", { name: "+ 결재 작성" }));
    fireEvent.change(screen.getByLabelText("결재 제목"), {
      target: { value: "설계 변경 계약 체결 품의" },
    });
    fireEvent.change(screen.getByLabelText("결재 내용"), {
      target: { value: "설계 변경 계약의 체결 승인을 요청합니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장 후 상신" }));
    await waitFor(() =>
      expect(screen.getByText("문서를 상신했습니다.")).toBeInTheDocument(),
    );
    expect(
      screen.getAllByText("설계 변경 계약 체결 품의").length,
    ).toBeGreaterThan(0);
  });
});
