import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IssueFeed } from "./issue-feed";
import { ProjectProvider } from "./project-context";

function storageMock() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

const renderIssueFeed = (adminMode = true) => render(<ProjectProvider><IssueFeed adminMode={adminMode} /></ProjectProvider>);

async function addPost(title = "신규 투자안 검토 요청") {
  fireEvent.click(await screen.findByRole("button", { name: "+ 새 이슈 등록" }));
  fireEvent.change(screen.getByLabelText("새 이슈 제목"), { target: { value: title } });
  fireEvent.change(screen.getByLabelText("새 이슈 내용"), { target: { value: "수익성 분석 후 의사결정 의견을 남겨주세요." } });
  fireEvent.click(screen.getByRole("button", { name: "이슈 등록" }));
  return screen.findByText(title);
}

describe("IssueFeed", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", { configurable: true, value: storageMock() });
    vi.restoreAllMocks();
  });

  it("예시 게시물 없이 빈 피드에서 시작한다", async () => {
    renderIssueFeed();
    expect(await screen.findByText("등록된 이슈가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("분양가·사업비 변동에 따른 수익성 민감도 검토")).not.toBeInTheDocument();
  });

  it("새 이슈를 등록하고 브라우저 데이터로 저장한다", async () => {
    renderIssueFeed();
    expect(await addPost()).toBeInTheDocument();
    expect(screen.getByText("수익성 분석 후 의사결정 의견을 남겨주세요.")).toBeInTheDocument();
    expect(window.localStorage.getItem("project-hub-issue-feed-v2")).toContain("신규 투자안 검토 요청");
  });

  it("본문에 이미지를 추가해 게시물 안에 표시한다", async () => {
    renderIssueFeed();
    fireEvent.click(await screen.findByRole("button", { name: "+ 새 이슈 등록" }));
    fireEvent.change(screen.getByLabelText("새 이슈 제목"), { target: { value: "현장 사진 공유" } });
    fireEvent.change(screen.getByLabelText("새 이슈 내용"), { target: { value: "현장 진행 상황입니다." } });
    const file = new File(["image"], "site.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("본문 이미지 또는 영상"), { target: { files: [file] } });
    expect(await screen.findByAltText("site.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이슈 등록" }));
    await waitFor(() => expect(screen.getByText("현장 사진 공유")).toBeInTheDocument());
    expect(screen.getByAltText("site.png")).toBeInTheDocument();
  });

  it("본문 드롭 영역에 놓은 영상을 미리보기에 추가한다", async () => {
    renderIssueFeed();
    fireEvent.click(await screen.findByRole("button", { name: "+ 새 이슈 등록" }));
    const dropzone = screen.getByLabelText("이슈 본문 이미지 및 영상 드롭 영역");
    const video = new File(["video"], "progress.mp4", { type: "video/mp4" });
    fireEvent.dragEnter(dropzone, { dataTransfer: { files: [video] } });
    expect(dropzone).toHaveClass("is-dragging");
    fireEvent.drop(dropzone, { dataTransfer: { files: [video] } });
    expect(await screen.findByLabelText("progress.mp4")).toBeInTheDocument();
    expect(dropzone).not.toHaveClass("is-dragging");
  });

  it("커서 위치에 놓은 이미지를 글 사이에 저장하고 같은 순서로 표시한다", async () => {
    const { container } = renderIssueFeed();
    fireEvent.click(await screen.findByRole("button", { name: "+ 새 이슈 등록" }));
    fireEvent.change(screen.getByLabelText("새 이슈 제목"), { target: { value: "글 사이 현장 사진" } });
    const editor = screen.getByLabelText("새 이슈 내용") as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "앞 내용뒤 내용" } });
    editor.setSelectionRange(4, 4);

    const file = new File(["image"], "middle.png", { type: "image/png" });
    fireEvent.drop(editor, { dataTransfer: { files: [file] } });

    expect(await screen.findByAltText("middle.png")).toBeInTheDocument();
    expect(screen.getByDisplayValue("앞 내용")).toBeInTheDocument();
    expect(screen.getByDisplayValue("뒤 내용")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이슈 등록" }));

    await screen.findByText("글 사이 현장 사진");
    const content = container.querySelector(".issue-post-content");
    expect(content?.children).toHaveLength(3);
    expect(content?.children[0]).toHaveTextContent("앞 내용");
    expect(content?.children[1]).toHaveAttribute("alt", "middle.png");
    expect(content?.children[2]).toHaveTextContent("뒤 내용");
  });

  it("삭제한 게시물을 관리자 휴지통에서 복구한다", async () => {
    renderIssueFeed();
    await addPost("복구 대상 게시물");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "복구 대상 게시물 게시물 메뉴" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /게시물 삭제/ }));
    expect(screen.queryByText("복구 대상 게시물")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "휴지통 (1)" }));
    expect(await screen.findByText("복구 대상 게시물")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "복구" }));
    fireEvent.click(screen.getByRole("button", { name: "피드로 돌아가기" }));
    expect(await screen.findByText("복구 대상 게시물")).toBeInTheDocument();
  });

  it("일반 사용자에게 휴지통 탭을 노출하지 않는다", async () => {
    renderIssueFeed(false);
    await screen.findByText("등록된 이슈가 없습니다.");
    expect(screen.queryByRole("button", { name: /휴지통/ })).not.toBeInTheDocument();
  });
});
