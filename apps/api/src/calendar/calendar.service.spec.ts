import { NotFoundException } from "@nestjs/common";

import type { PrismaService } from "../database/prisma.service";
import type { InputSecurityService } from "../feed/input-security.service";
import type { CollaborationService } from "../projects/collaboration.service";
import { CalendarService } from "./calendar.service";

describe("CalendarService 권한 범위", () => {
  it("프로젝트 비멤버는 일정 쿼리를 실행하지 못한다", async () => {
    const findMany = jest.fn(); const collaboration = { authorizeProject: jest.fn().mockRejectedValue(new NotFoundException()) } as unknown as CollaborationService;
    const service = new CalendarService({ calendarEvent: { findMany } } as unknown as PrismaService, collaboration, {} as InputSecurityService, {} as never, {} as never);
    await expect(service.list({ id: "outsider", isActive: true, platformRole: "USER" }, "private-project", { from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" })).rejects.toBeInstanceOf(NotFoundException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("조회 가능한 그룹 ID만 일정 목록 조건에 포함한다", async () => {
    const findMany = jest.fn().mockResolvedValue([]); const collaboration = { authorizeProject: jest.fn().mockResolvedValue({ membership: { id: "member-1", role: "PARTICIPANT" } }), listGroups: jest.fn().mockResolvedValue([{ id: "group-a", name: "허용 그룹" }]) } as unknown as CollaborationService;
    const service = new CalendarService({ calendarEvent: { findMany } } as unknown as PrismaService, collaboration, {} as InputSecurityService, {} as never, {} as never);
    await service.list({ id: "user-1", isActive: true, platformRole: "USER" }, "project-a", { from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ projectId: "project-a", OR: [{ groupId: null }, { groupId: { in: ["group-a"] } }] }) }));
  });
});
