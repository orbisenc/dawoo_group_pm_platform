import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { DriveService } from "../drive/drive.service";
import type { Actor } from "../projects/collaboration.types";
import { CollaborationService } from "../projects/collaboration.service";
import type { GlobalSearchDto } from "./dashboard.dto";

const issueSelect = {
  id: true,
  projectId: true,
  groupId: true,
  title: true,
  status: true,
  priority: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
} satisfies Prisma.FeedPostSelect;

const eventSelect = {
  id: true,
  projectId: true,
  groupId: true,
  title: true,
  kind: true,
  startsAt: true,
  endsAt: true,
  allDay: true,
  project: { select: { id: true, name: true } },
} satisfies Prisma.CalendarEventSelect;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collaboration: CollaborationService,
    private readonly drive: DriveService,
  ) {}

  async getDashboard(actor: Actor, projectId?: string) {
    const projects = await this.accessibleProjects(actor);
    const scopedProjects = projectId
      ? projects.filter((project) => project.id === projectId)
      : projects;
    if (projectId && scopedProjects.length === 0)
      throw new ForbiddenException("접근할 수 없는 프로젝트입니다.");
    const now = new Date();
    const upcomingTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const scoped = await Promise.all(
      scopedProjects.map(async (project) => {
        const groupIds = (
          await this.collaboration.listGroups(actor, project.id)
        ).map((group) => group.id);
        const issueWhere: Prisma.FeedPostWhereInput = {
          projectId: project.id,
          groupId: { in: groupIds },
          archivedAt: null,
          type: "ISSUE",
        };
        const eventWhere: Prisma.CalendarEventWhereInput = {
          projectId: project.id,
          archivedAt: null,
          OR: [{ groupId: null }, { groupId: { in: groupIds } }],
        };
        const [
          myIssues,
          unresolvedIssues,
          upcomingEvents,
          recentFiles,
          issueCount,
          eventCount,
          fileCount,
          pendingApprovals,
          latestApproval,
        ] = await Promise.all([
          this.prisma.feedPost.findMany({
            where: {
              ...issueWhere,
              assigneeId: actor.id,
              status: { not: "COMPLETED" },
            },
            select: issueSelect,
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: 8,
          }),
          this.prisma.feedPost.findMany({
            where: { ...issueWhere, status: { not: "COMPLETED" } },
            select: issueSelect,
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: 8,
          }),
          this.prisma.calendarEvent.findMany({
            where: { ...eventWhere, startsAt: { gte: now, lte: upcomingTo } },
            select: eventSelect,
            orderBy: [{ startsAt: "asc" }, { id: "asc" }],
            take: 8,
          }),
          this.drive.listRecentAccessibleFiles(actor, project.id, 8),
          this.prisma.feedPost.count({ where: issueWhere }),
          this.prisma.calendarEvent.count({ where: eventWhere }),
          this.drive.countAccessibleFiles(actor, project.id),
          this.prisma.approvalStep.count({
            where: {
              approverId: actor.id,
              status: "ACTIVE",
              revision: { projectId: project.id },
            },
          }),
          this.prisma.approvalDocument.findFirst({
            where: { projectId: project.id },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        const latestDates = [
          unresolvedIssues[0]?.updatedAt,
          upcomingEvents[0]?.startsAt,
          recentFiles[0]?.updatedAt,
          latestApproval?.updatedAt,
        ].filter((value): value is Date => value instanceof Date);
        return {
          project,
          myIssues,
          unresolvedIssues,
          upcomingEvents,
          recentFiles: recentFiles.map((file) => ({
            ...file,
            project: { id: project.id, name: project.name },
          })),
          activity: {
            projectId: project.id,
            projectName: project.name,
            issueCount,
            eventCount,
            fileCount,
            pendingApprovalCount: pendingApprovals,
            lastActivityAt:
              latestDates.sort((a, b) => b.getTime() - a.getTime())[0] ??
              project.updatedAt,
          },
        };
      }),
    );
    const sortUpdated = <T extends { updatedAt: Date }>(items: T[]) =>
      items
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 8);
    const sortUpcoming = <T extends { startsAt: Date }>(items: T[]) =>
      items
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
        .slice(0, 8);
    const recentFiles = scoped
      .flatMap((item) => item.recentFiles)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 8);
    return {
      projects,
      selectedProjectId: projectId ?? projects[0]?.id ?? null,
      myIssues: sortUpdated(scoped.flatMap((item) => item.myIssues)),
      unresolvedIssues: sortUpdated(
        scoped.flatMap((item) => item.unresolvedIssues),
      ),
      upcomingEvents: sortUpcoming(
        scoped.flatMap((item) => item.upcomingEvents),
      ),
      recentFiles,
      pendingApprovalCount: scoped.reduce(
        (sum, item) => sum + item.activity.pendingApprovalCount,
        0,
      ),
      projectActivity: scoped
        .map((item) => item.activity)
        .sort(
          (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime(),
        ),
    };
  }

  async search(actor: Actor, dto: GlobalSearchDto) {
    const projects = await this.accessibleProjects(actor);
    const query = dto.query.trim();
    const results = await Promise.all(
      projects.map(async (project) => {
        const groupIds = (
          await this.collaboration.listGroups(actor, project.id)
        ).map((group) => group.id);
        const [issues, events, files, approvals] = await Promise.all([
          this.prisma.feedPost.findMany({
            where: {
              projectId: project.id,
              groupId: { in: groupIds },
              archivedAt: null,
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { content: { contains: query, mode: "insensitive" } },
                { tags: { has: query.toLowerCase() } },
              ],
            },
            select: {
              id: true,
              groupId: true,
              title: true,
              status: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
            take: dto.limit,
          }),
          this.prisma.calendarEvent.findMany({
            where: {
              projectId: project.id,
              archivedAt: null,
              OR: [{ groupId: null }, { groupId: { in: groupIds } }],
              AND: {
                OR: [
                  { title: { contains: query, mode: "insensitive" } },
                  { description: { contains: query, mode: "insensitive" } },
                  { milestoneName: { contains: query, mode: "insensitive" } },
                ],
              },
            },
            select: { id: true, title: true, startsAt: true },
            orderBy: { startsAt: "asc" },
            take: dto.limit,
          }),
          this.drive.listRecentAccessibleFiles(
            actor,
            project.id,
            dto.limit,
            query,
          ),
          this.prisma.approvalDocument.findMany({
            where: {
              projectId: project.id,
              title: { contains: query, mode: "insensitive" },
            },
            select: { id: true, title: true, status: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
            take: dto.limit,
          }),
        ]);
        return [
          ...issues.map((item) => ({
            type: "ISSUE" as const,
            id: item.id,
            title: item.title,
            subtitle: `${project.name} · 이슈`,
            href: "/issues",
            occurredAt: item.updatedAt,
          })),
          ...events.map((item) => ({
            type: "CALENDAR" as const,
            id: item.id,
            title: item.title,
            subtitle: `${project.name} · 일정`,
            href: "/calendar",
            occurredAt: item.startsAt,
          })),
          ...files.map((item) => ({
            type: "FILE" as const,
            id: item.id,
            title: item.name,
            subtitle: `${project.name} · 공유 문서`,
            href: "/drive",
            occurredAt: item.updatedAt,
          })),
          ...approvals.map((item) => ({
            type: "APPROVAL" as const,
            id: item.id,
            title: item.title,
            subtitle: `${project.name} · 결재`,
            href: "/approvals",
            occurredAt: item.updatedAt,
          })),
        ];
      }),
    );
    const projectResults = projects
      .filter((project) =>
        [project.name, project.code, project.description ?? ""].some((value) =>
          value.toLowerCase().includes(query.toLowerCase()),
        ),
      )
      .map((project) => ({
        type: "PROJECT" as const,
        id: project.id,
        title: project.name,
        subtitle: `${project.code} · 프로젝트`,
        href: "/projects",
        occurredAt: project.updatedAt,
      }));
    return {
      query,
      items: [...projectResults, ...results.flat()]
        .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
        .slice(0, dto.limit * 5),
    };
  }

  private accessibleProjects(actor: Actor) {
    return this.prisma.project.findMany({
      where:
        actor.platformRole === "PLATFORM_ADMIN"
          ? {}
          : { memberships: { some: { userId: actor.id, status: "ACTIVE" } } },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        status: true,
        startsAt: true,
        endsAt: true,
        updatedAt: true,
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
  }
}
