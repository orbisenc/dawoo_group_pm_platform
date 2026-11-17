import type { PrismaService } from "../database/prisma.service";
import type { DriveService } from "../drive/drive.service";
import type { CollaborationService } from "../projects/collaboration.service";
import { DashboardService } from "./dashboard.service";

describe("DashboardService 접근 범위", () => {
  it("일반 사용자는 활성 멤버십 프로젝트만 집계한다", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new DashboardService(
      { project: { findMany } } as unknown as PrismaService,
      {} as CollaborationService,
      {} as DriveService,
    );
    const result = await service.getDashboard({
      id: "user-1",
      isActive: true,
      platformRole: "USER",
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          memberships: { some: { userId: "user-1", status: "ACTIVE" } },
        },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        projects: [],
        myIssues: [],
        recentFiles: [],
        pendingApprovalCount: 0,
      }),
    );
  });

  it("접근 가능한 프로젝트가 없으면 검색 결과도 반환하지 않는다", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new DashboardService(
      { project: { findMany } } as unknown as PrismaService,
      {} as CollaborationService,
      {} as DriveService,
    );
    const result = await service.search(
      { id: "user-1", isActive: true, platformRole: "USER" },
      { query: "비공개", limit: 8 },
    );
    expect(result.items).toEqual([]);
  });

  it("멤버십이 없는 프로젝트를 대시보드 범위로 지정하면 거부한다", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new DashboardService(
      { project: { findMany } } as unknown as PrismaService,
      {} as CollaborationService,
      {} as DriveService,
    );
    await expect(
      service.getDashboard(
        { id: "user-1", isActive: true, platformRole: "USER" },
        "30000000-0000-4000-8000-000000000099",
      ),
    ).rejects.toThrow("접근할 수 없는 프로젝트입니다.");
  });
});
