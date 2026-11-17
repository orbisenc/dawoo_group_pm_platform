import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { CurrentActor } from "../auth/current-actor.decorator";
import type { Actor } from "./collaboration.types";
import { CollaborationService } from "./collaboration.service";
import { AddGroupMemberDto, ChangeGroupRoleDto, ChangeProjectRoleDto, CreateGroupDto, CreateProjectDto, InviteMemberDto, UpdateGroupDto, UpdateProjectDto } from "./collaboration.dto";

@Controller("projects")
@UseGuards(ApiAuthGuard)
export class CollaborationController {
  constructor(private readonly service: CollaborationService) {}

  @Post() createProject(@CurrentActor() actor: Actor, @Body() dto: CreateProjectDto) { return this.service.createProject(actor, dto); }
  @Get(":projectId") getProject(@CurrentActor() actor: Actor, @Param("projectId") projectId: string) { return this.service.getProject(actor, projectId); }
  @Patch(":projectId") updateProject(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Body() dto: UpdateProjectDto) { return this.service.updateProject(actor, projectId, dto); }

  @Get(":projectId/members") listMembers(@CurrentActor() actor: Actor, @Param("projectId") projectId: string) { return this.service.listMembers(actor, projectId); }
  @Post(":projectId/members") inviteMember(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Body() dto: InviteMemberDto) { return this.service.inviteMember(actor, projectId, dto); }
  @Patch(":projectId/members/:memberId/role") changeMemberRole(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("memberId") memberId: string, @Body() dto: ChangeProjectRoleDto) { return this.service.changeMemberRole(actor, projectId, memberId, dto.role); }
  @Delete(":projectId/members/:memberId") removeMember(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("memberId") memberId: string) { return this.service.removeMember(actor, projectId, memberId); }

  @Get(":projectId/groups") listGroups(@CurrentActor() actor: Actor, @Param("projectId") projectId: string) { return this.service.listGroups(actor, projectId); }
  @Post(":projectId/groups") createGroup(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Body() dto: CreateGroupDto) { return this.service.createGroup(actor, projectId, { ...dto, description: dto.description ?? null, isPrivate: dto.isPrivate ?? true }); }
  @Get(":projectId/groups/:groupId") getGroup(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string) { return this.service.getGroup(actor, projectId, groupId); }
  @Patch(":projectId/groups/:groupId") updateGroup(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string, @Body() dto: UpdateGroupDto) { return this.service.updateGroup(actor, projectId, groupId, dto); }
  @Post(":projectId/groups/:groupId/members") addGroupMember(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string, @Body() dto: AddGroupMemberDto) { return this.service.addGroupMember(actor, projectId, groupId, dto.projectMembershipId, dto.role); }
  @Patch(":projectId/groups/:groupId/members/:groupMemberId/role") changeGroupMemberRole(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string, @Param("groupMemberId") groupMemberId: string, @Body() dto: ChangeGroupRoleDto) { return this.service.changeGroupMemberRole(actor, projectId, groupId, groupMemberId, dto.role); }
  @Delete(":projectId/groups/:groupId/members/:groupMemberId") removeGroupMember(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string, @Param("groupMemberId") groupMemberId: string) { return this.service.removeGroupMember(actor, projectId, groupId, groupMemberId); }
}
