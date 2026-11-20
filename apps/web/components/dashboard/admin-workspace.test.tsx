import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminWorkspace } from "./admin-workspace";

const listApprovedAccounts = vi.fn();
const updateAccountRole = vi.fn();
const listRegistrations = vi.fn();
const decideRegistration = vi.fn();

vi.mock("../auth/auth-context", () => ({
  useAuth: () => ({
    isAdmin: true,
    listApprovedAccounts,
    updateAccountRole,
    listRegistrations,
    decideRegistration,
  }),
}));

describe("관리자 계정 화면", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listApprovedAccounts.mockResolvedValue({
      summary: { approvedAccounts: 2, administrators: 1, users: 1 },
      items: [
        { id: "user-1", username: "hong", email: "hong@example.com", name: "홍길동", platformRole: "USER", createdAt: "2026-11-18T00:00:00.000Z", approvedAt: "2026-11-19T00:00:00.000Z" },
        { id: "admin-1", username: "kim", email: "kim@example.com", name: "김관리", platformRole: "PLATFORM_ADMIN", createdAt: "2026-11-17T00:00:00.000Z", approvedAt: "2026-11-18T00:00:00.000Z" },
      ],
    });
    listRegistrations.mockResolvedValue([
      { id: "pending-1", username: "lee", email: "lee@example.com", name: "이신청", createdAt: "2026-11-19T00:00:00.000Z" },
    ]);
    updateAccountRole.mockResolvedValue(undefined);
    decideRegistration.mockResolvedValue(undefined);
  });

  it("실제 승인 계정 집계와 계정만 표시한다", async () => {
    render(<AdminWorkspace />);
    expect(await screen.findByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("김관리")).toBeInTheDocument();
    expect(screen.getByText("승인 계정 2명")).toBeInTheDocument();
    expect(screen.queryByText("참여자 48명")).not.toBeInTheDocument();
    expect(screen.queryByText("김지훈")).not.toBeInTheDocument();
  });

  it("승인 계정의 관리자 역할을 변경한다", async () => {
    render(<AdminWorkspace />);
    const role = await screen.findByLabelText("홍길동 플랫폼 역할");
    fireEvent.change(role, { target: { value: "PLATFORM_ADMIN" } });
    await waitFor(() => expect(updateAccountRole).toHaveBeenCalledWith("user-1", "PLATFORM_ADMIN"));
  });

  it("가입 승인 탭에서 대기 신청을 승인한다", async () => {
    render(<AdminWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: "가입 승인 (1)" }));
    expect(await screen.findByText("이신청")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    await waitFor(() => expect(decideRegistration).toHaveBeenCalledWith("pending-1", "approve"));
  });
});
