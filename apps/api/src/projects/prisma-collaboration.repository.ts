import { Injectable } from "@nestjs/common";
import type { GroupRole, ProjectRole } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import {
  CollaborationRepository,
  type CreateGroupData,
  type CreateMemberData,
  type CreateProjectData,
  type UpdateGroupData,
  type UpdateProjectData,
} from "./collaboration.types";

const DEFAULT_DRIVE_FOLDERS = ["01_사업관리", "02_토지계약", "03_인허가", "04_설계도면", "05_금융PF", "06_계약발주", "07_공사공정", "08_회의록"];

@Injectable()
export class PrismaCollaborationRepository extends CollaborationRepository {
  constructor(private readonly prisma: PrismaService) { super(); }

  findActor(userId: string) { return this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true, platformRole: true } }); }
  async findOrganizationRole(userId: string, organizationId: string) {
    const membership = await this.prisma.organizationMembership.findFirst({ where: { userId, organizationId, status: "ACTIVE" }, select: { role: true } });
    return membership?.role ?? null;
  }
  findProject(projectId: string) { return this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true, organizationId: true, code: true, name: true, description: true, status: true } }); }
  createProjectWithAdmin(data: CreateProjectData, adminUserId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const project = await transaction.project.create({ data, select: { id: true, organizationId: true, code: true, name: true, description: true, status: true } });
      await transaction.projectMembership.create({ data: { projectId: project.id, userId: adminUserId, organizationId: data.organizationId, role: "CLIENT_ADMIN" } });
      await transaction.driveFolder.createMany({ data: DEFAULT_DRIVE_FOLDERS.map((name) => ({ projectId: project.id, createdById: adminUserId, name })) });
      return project;
    });
  }
  updateProject(projectId: string, data: UpdateProjectData) { return this.prisma.project.update({ where: { id: projectId }, data, select: { id: true, organizationId: true, code: true, name: true, description: true, status: true } }); }
  findMembership(projectId: string, userId: string) { return this.prisma.projectMembership.findUnique({ where: { projectId_userId: { projectId, userId } }, select: { id: true, projectId: true, userId: true, organizationId: true, role: true, status: true } }); }
  findMemberById(projectId: string, memberId: string) { return this.prisma.projectMembership.findFirst({ where: { id: memberId, projectId }, select: { id: true, projectId: true, userId: true, organizationId: true, role: true, status: true } }); }
  listMembers(projectId: string) { return this.prisma.projectMembership.findMany({ where: { projectId, status: "ACTIVE" }, select: { id: true, projectId: true, userId: true, organizationId: true, role: true, status: true }, orderBy: { createdAt: "asc" } }); }
  createMember(data: CreateMemberData) { return this.prisma.projectMembership.create({ data, select: { id: true, projectId: true, userId: true, organizationId: true, role: true, status: true } }); }
  updateMemberRole(memberId: string, role: ProjectRole) { return this.prisma.projectMembership.update({ where: { id: memberId }, data: { role }, select: { id: true, projectId: true, userId: true, organizationId: true, role: true, status: true } }); }
  deactivateMember(memberId: string) { return this.prisma.projectMembership.update({ where: { id: memberId }, data: { status: "INACTIVE" }, select: { id: true, projectId: true, userId: true, organizationId: true, role: true, status: true } }); }
  countActiveProjectAdmins(projectId: string) { return this.prisma.projectMembership.count({ where: { projectId, status: "ACTIVE", role: { in: ["CLIENT_ADMIN", "PROJECT_ADMIN"] } } }); }
  listGroups(projectId: string) { return this.prisma.collaborationGroup.findMany({ where: { projectId }, include: { memberships: { select: { id: true, projectMembershipId: true, role: true } } }, orderBy: { name: "asc" } }); }
  findGroup(projectId: string, groupId: string) { return this.prisma.collaborationGroup.findFirst({ where: { id: groupId, projectId }, include: { memberships: { select: { id: true, projectMembershipId: true, role: true } } } }); }
  createGroup(data: CreateGroupData) { return this.prisma.collaborationGroup.create({ data, include: { memberships: { select: { id: true, projectMembershipId: true, role: true } } } }); }
  updateGroup(groupId: string, data: UpdateGroupData) { return this.prisma.collaborationGroup.update({ where: { id: groupId }, data, include: { memberships: { select: { id: true, projectMembershipId: true, role: true } } } }); }
  addGroupMember(groupId: string, projectMembershipId: string, role: GroupRole) { return this.prisma.groupMembership.create({ data: { groupId, projectMembershipId, role }, select: { id: true, projectMembershipId: true, role: true } }); }
  updateGroupMemberRole(groupMemberId: string, role: GroupRole) { return this.prisma.groupMembership.update({ where: { id: groupMemberId }, data: { role }, select: { id: true, projectMembershipId: true, role: true } }); }
  async removeGroupMember(groupMemberId: string) { await this.prisma.groupMembership.delete({ where: { id: groupMemberId } }); }
}
