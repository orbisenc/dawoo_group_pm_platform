import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IssueFeed } from "./issue-feed";
import { ProjectProvider } from "./project-context";

const renderIssueFeed = () => render(<ProjectProvider><IssueFeed /></ProjectProvider>);

describe("IssueFeed", () => {
  it("사업성 검토 게시물과 의사결정 댓글을 표시한다", () => {
    renderIssueFeed();

    expect(screen.getByText("분양가·사업비 변동에 따른 수익성 민감도 검토")).toBeInTheDocument();
    expect(screen.queryByLabelText("첨부사진 1")).not.toBeInTheDocument();
    expect(screen.getByText("금융비용 0.5%p 상승 시나리오를 추가한 뒤 투자심의 안건으로 상정하겠습니다.")).toBeInTheDocument();
  });

  it("사용자가 새 댓글을 등록할 수 있다", () => {
    renderIssueFeed();

    const input = screen.getByLabelText("분양가·사업비 변동에 따른 수익성 민감도 검토 댓글 입력");
    fireEvent.change(input, { target: { value: "투자심의 자료에 반영하겠습니다." } });
    fireEvent.submit(input.closest("form")!);

    expect(screen.getByText("투자심의 자료에 반영하겠습니다.")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("새 이슈를 등록하고 상태 필터를 적용한다", () => {
    renderIssueFeed();

    fireEvent.click(screen.getByRole("button", { name: "+ 새 이슈 등록" }));
    fireEvent.change(screen.getByLabelText("새 이슈 제목"), { target: { value: "신규 투자안 검토 요청" } });
    fireEvent.change(screen.getByLabelText("새 이슈 내용"), { target: { value: "수익성 분석 후 의사결정 의견을 남겨주세요." } });
    fireEvent.click(screen.getByRole("button", { name: "이슈 등록" }));
    expect(screen.getByText("신규 투자안 검토 요청")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "완료" }));
    expect(screen.queryByText("신규 투자안 검토 요청")).not.toBeInTheDocument();
    expect(screen.getByText("도시개발 인허가 선행조건 및 일정 리스크 검토")).toBeInTheDocument();
  });
});
