import type { GroupRole, MembershipStatus, OrganizationRole, PlatformRole, ProjectRole, ProjectStatus } from "@prisma/client";

export type Actor = { id: string; isActive: boolean; platformRole: PlatformRole };

export type ProjectView = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
};

export type ProjectMemberView = {
  id: string;
  projectId: string;
  userId: string;
  organizationId: string;
  role: ProjectRole;
  status: MembershipStatus;
};

export type GroupMemberView = {
  id: string;
  projectMembershipId: string;
  role: GroupRole;
};

export type GroupView = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  createdById: string;
  memberships: GroupMemberView[];
};

export type CreateProjectData = Pick<ProjectView, "organizationId" | "code" | "name"> & Partial<Pick<ProjectView, "description" | "status">>;
export type UpdateProjectData = Partial<Pick<ProjectView, "name" | "description" | "status">>;
export type CreateMemberData = Pick<ProjectMemberView, "projectId" | "userId" | "organizationId" | "role">;
export type CreateGroupData = Pick<GroupView, "projectId" | "name" | "description" | "isPrivate" | "createdById">;
export type UpdateGroupData = Partial<Pick<GroupView, "name" | "description" | "isPrivate">>;

export abstract class CollaborationRepository {
  abstract findActor(userId: string): Promise<Actor | null>;
  abstract findOrganizationRole(userId: string, organizationId: string): Promise<OrganizationRole | null>;
  abstract findProject(projectId: string): Promise<ProjectView | null>;
  abstract createProjectWithAdmin(data: CreateProjectData, adminUserId: string): Promise<ProjectView>;
  abstract updateProject(projectId: string, data: UpdateProjectData): Promise<ProjectView>;
  abstract findMembership(projectId: string, userId: string): Promise<ProjectMemberView | null>;
  abstract findMemberById(projectId: string, memberId: string): Promise<ProjectMemberView | null>;
  abstract listMembers(projectId: string): Promise<ProjectMemberView[]>;
  abstract createMember(data: CreateMemberData): Promise<ProjectMemberView>;
  abstract updateMemberRole(memberId: string, role: ProjectRole): Promise<ProjectMemberView>;
  abstract deactivateMember(memberId: string): Promise<ProjectMemberView>;
  abstract countActiveProjectAdmins(projectId: string): Promise<number>;
  abstract listGroups(projectId: string): Promise<GroupView[]>;
  abstract findGroup(projectId: string, groupId: string): Promise<GroupView | null>;
  abstract createGroup(data: CreateGroupData): Promise<GroupView>;
  abstract updateGroup(groupId: string, data: UpdateGroupData): Promise<GroupView>;
  abstract addGroupMember(groupId: string, projectMembershipId: string, role: GroupRole): Promise<GroupMemberView>;
  abstract updateGroupMemberRole(groupMemberId: string, role: GroupRole): Promise<GroupMemberView>;
  abstract removeGroupMember(groupMemberId: string): Promise<void>;
}
