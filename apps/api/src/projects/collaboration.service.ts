import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { GroupRole, ProjectRole } from "@prisma/client";

import type { Actor, CreateGroupData, CreateProjectData, GroupView, ProjectMemberView, UpdateGroupData, UpdateProjectData } from "./collaboration.types";
import { CollaborationRepository } from "./collaboration.types";
import { ProjectAccessPolicy } from "./project-access.policy";

@Injectable()
export class CollaborationService {
  constructor(private readonly repository: CollaborationRepository, private readonly policy: ProjectAccessPolicy) {}

  async createProject(actor: Actor, data: CreateProjectData) {
    const organizationRole = await this.repository.findOrganizationRole(actor.id, data.organizationId);
    if (actor.platformRole !== "PLATFORM_ADMIN" && organizationRole !== "ORG_OWNER" && organizationRole !== "ORG_ADMIN") {
      throw new ForbiddenException("프로젝트를 생성할 권한이 없습니다.");
    }
    return this.repository.createProjectWithAdmin(data, actor.id);
  }

  async getProject(actor: Actor, projectId: string) {
    const { project } = await this.requireProjectMembership(actor, projectId);
    return project;
  }

  async authorizeProject(actor: Actor, projectId: string, write: boolean) {
    const access = await this.requireProjectMembership(actor, projectId);
    if (write && actor.platformRole !== "PLATFORM_ADMIN" && (!access.membership || access.membership.role === "READ_ONLY" || access.membership.role === "VIEWER")) {
      throw new ForbiddenException("이 프로젝트의 파일을 변경할 권한이 없습니다.");
    }
    return access;
  }

  async updateProject(actor: Actor, projectId: string, data: UpdateProjectData) {
    const { membership } = await this.requireProjectMembership(actor, projectId);
    if (actor.platformRole !== "PLATFORM_ADMIN" && (!membership || !this.policy.canUpdateProject(membership.role))) {
      throw new ForbiddenException("프로젝트를 수정할 권한이 없습니다.");
    }
    return this.repository.updateProject(projectId, data);
  }

  async archiveProject(actor: Actor, projectId: string) {
    if (actor.platformRole !== "PLATFORM_ADMIN") {
      throw new ForbiddenException("관리자만 프로젝트를 삭제할 수 있습니다.");
    }
    const project = await this.repository.findProject(projectId);
    if (!project) throw new NotFoundException("프로젝트를 찾을 수 없습니다.");
    return this.repository.archiveProject(projectId);
  }

  async listMembers(actor: Actor, projectId: string) {
    await this.requireProjectMembership(actor, projectId);
    return this.repository.listMembers(projectId);
  }

  async inviteMember(actor: Actor, projectId: string, data: Omit<ProjectMemberView, "id" | "projectId" | "status">) {
    const { membership } = await this.requireProjectMembership(actor, projectId);
    this.assertCanManageMember(actor, membership, data.role);
    const [targetUser, organizationRole] = await Promise.all([
      this.repository.findActor(data.userId),
      this.repository.findOrganizationRole(data.userId, data.organizationId),
    ]);
    if (!targetUser?.isActive || !organizationRole) throw new NotFoundException("해당 회사의 활성 사용자를 찾을 수 없습니다.");
    return this.repository.createMember({ projectId, ...data });
  }

  async changeMemberRole(actor: Actor, projectId: string, memberId: string, role: ProjectRole) {
    const { membership } = await this.requireProjectMembership(actor, projectId);
    const target = await this.repository.findMemberById(projectId, memberId);
    if (!target) throw new NotFoundException("프로젝트 참여자를 찾을 수 없습니다.");
    this.assertCanManageMember(actor, membership, role);
    if (target.userId === actor.id && target.role !== role) throw new ForbiddenException("자신의 역할은 직접 변경할 수 없습니다.");
    return this.repository.updateMemberRole(memberId, role);
  }

  async removeMember(actor: Actor, projectId: string, memberId: string) {
    const { membership } = await this.requireProjectMembership(actor, projectId);
    const target = await this.repository.findMemberById(projectId, memberId);
    if (!target) throw new NotFoundException("프로젝트 참여자를 찾을 수 없습니다.");
    this.assertCanManageMember(actor, membership, target.role);
    if ((target.role === "CLIENT_ADMIN" || target.role === "PROJECT_ADMIN") && await this.repository.countActiveProjectAdmins(projectId) <= 1) {
      throw new ForbiddenException("마지막 시행사 관리자는 제외할 수 없습니다.");
    }
    return this.repository.deactivateMember(memberId);
  }

  async listGroups(actor: Actor, projectId: string) {
    const { membership } = await this.requireProjectMembership(actor, projectId);
    const groups = await this.repository.listGroups(projectId);
    if (actor.platformRole === "PLATFORM_ADMIN" || (membership && this.policy.canSeeAllGroups(membership.role))) return groups;
    return groups.filter((group) => !group.isPrivate || group.memberships.some((item) => item.projectMembershipId === membership?.id));
  }

  async getGroup(actor: Actor, projectId: string, groupId: string) {
    const { group } = await this.authorizeGroup(actor, projectId, groupId, false);
    return group;
  }

  async authorizeGroup(actor: Actor, projectId: string, groupId: string, write: boolean) {
    const { membership } = await this.requireProjectMembership(actor, projectId);
    const group = await this.requireGroup(projectId, groupId);
    this.assertCanReadGroup(actor, membership, group);
    if (write) this.assertCanWriteGroup(actor, membership, group);
    return { membership, group };
  }

  async createGroup(actor: Actor, projectId: string, data: Omit<CreateGroupData, "projectId" | "createdById">) {
    const { membership } = await this.requireProjectMembership(actor, projectId);
    this.assertCanManageGroups(actor, membership);
    const group = await this.repository.createGroup({ projectId, createdById: actor.id, ...data });
    if (membership) await this.repository.addGroupMember(group.id, membership.id, "GROUP_ADMIN");
    return group;
  }

  async updateGroup(actor: Actor, projectId: string, groupId: string, data: UpdateGroupData) {
    const { membership } = await this.requireProjectMembership(actor, projectId);
    const group = await this.requireGroup(projectId, groupId);
    this.assertCanManageGroup(actor, membership, group);
    return this.repository.updateGroup(groupId, data);
  }

  async addGroupMember(actor: Actor, projectId: string, groupId: string, projectMembershipId: string, role: GroupRole) {
    const { membership } = await this.requireProjectMembership(actor, projectId);
    const group = await this.requireGroup(projectId, groupId);
    this.assertCanManageGroup(actor, membership, group);
    const target = await this.repository.findMemberById(projectId, projectMembershipId);
    if (!target || target.status !== "ACTIVE") throw new NotFoundException("같은 프로젝트의 활성 참여자를 찾을 수 없습니다.");
    return this.repository.addGroupMember(groupId, projectMembershipId, role);
  }

  async changeGroupMemberRole(actor: Actor, projectId: string, groupId: string, groupMemberId: string, role: GroupRole) {
    const { membership } = await this.requireProjectMembership(actor, projectId);
    const group = await this.requireGroup(projectId, groupId);
    this.assertCanManageGroup(actor, membership, group);
    if (!group.memberships.some((item) => item.id === groupMemberId)) throw new NotFoundException("그룹 참여자를 찾을 수 없습니다.");
    return this.repository.updateGroupMemberRole(groupMemberId, role);
  }

  async removeGroupMember(actor: Actor, projectId: string, groupId: string, groupMemberId: string) {
    const { membership } = await this.requireProjectMembership(actor, projectId);
    const group = await this.requireGroup(projectId, groupId);
    this.assertCanManageGroup(actor, membership, group);
    if (!group.memberships.some((item) => item.id === groupMemberId)) throw new NotFoundException("그룹 참여자를 찾을 수 없습니다.");
    await this.repository.removeGroupMember(groupMemberId);
    return { removed: true };
  }

  private async requireProjectMembership(actor: Actor, projectId: string) {
    const project = await this.repository.findProject(projectId);
    if (!project) throw new NotFoundException("프로젝트를 찾을 수 없습니다.");
    if (actor.platformRole === "PLATFORM_ADMIN") return { project, membership: null };
    const membership = await this.repository.findMembership(projectId, actor.id);
    if (!membership || membership.status !== "ACTIVE") throw new NotFoundException("프로젝트를 찾을 수 없습니다.");
    return { project, membership };
  }

  private async requireGroup(projectId: string, groupId: string) {
    const group = await this.repository.findGroup(projectId, groupId);
    if (!group) throw new NotFoundException("협업 그룹을 찾을 수 없습니다.");
    return group;
  }

  private assertCanManageMember(actor: Actor, membership: ProjectMemberView | null, role: ProjectRole) {
    if (actor.platformRole === "PLATFORM_ADMIN") return;
    if (!membership) throw new ForbiddenException("참여자를 관리할 권한이 없습니다.");
    this.policy.assertCanAssignRole(membership.role, role);
  }

  private assertCanManageGroups(actor: Actor, membership: ProjectMemberView | null) {
    if (actor.platformRole === "PLATFORM_ADMIN") return;
    if (!membership || !this.policy.canManageGroups(membership.role)) throw new ForbiddenException("협업 그룹을 관리할 권한이 없습니다.");
  }

  private assertCanManageGroup(actor: Actor, membership: ProjectMemberView | null, group: GroupView) {
    if (actor.platformRole === "PLATFORM_ADMIN") return;
    if (!membership) throw new ForbiddenException("협업 그룹을 관리할 권한이 없습니다.");
    if (this.policy.canSeeAllGroups(membership.role)) return;
    const groupMembership = group.memberships.find((item) => item.projectMembershipId === membership.id);
    if (membership.role === "GROUP_ADMIN" && groupMembership?.role === "GROUP_ADMIN") return;
    throw new ForbiddenException("해당 협업 그룹을 관리할 권한이 없습니다.");
  }

  private assertCanReadGroup(actor: Actor, membership: ProjectMemberView | null, group: GroupView) {
    if (!group.isPrivate || actor.platformRole === "PLATFORM_ADMIN") return;
    if (membership && (this.policy.canSeeAllGroups(membership.role) || group.memberships.some((item) => item.projectMembershipId === membership.id))) return;
    throw new NotFoundException("협업 그룹을 찾을 수 없습니다.");
  }

  private assertCanWriteGroup(actor: Actor, membership: ProjectMemberView | null, group: GroupView) {
    if (actor.platformRole === "PLATFORM_ADMIN") return;
    if (!membership || membership.role === "READ_ONLY" || membership.role === "VIEWER") throw new ForbiddenException("이 협업 그룹에 작성할 권한이 없습니다.");
    if (this.policy.canSeeAllGroups(membership.role)) return;
    const groupMembership = group.memberships.find((item) => item.projectMembershipId === membership.id);
    if (!groupMembership || groupMembership.role === "READ_ONLY") throw new ForbiddenException("이 협업 그룹에 작성할 권한이 없습니다.");
  }
}
