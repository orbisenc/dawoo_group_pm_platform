import { GroupRole, ProjectRole, ProjectStatus } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from "class-validator";

export class CreateProjectDto {
  @IsUUID() organizationId: string;
  @IsString() @Length(2, 50) code: string;
  @IsString() @Length(2, 200) name: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @Length(2, 200) name?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
}

export class InviteMemberDto {
  @IsUUID() userId: string;
  @IsUUID() organizationId: string;
  @IsEnum(ProjectRole) role: ProjectRole;
}

export class ChangeProjectRoleDto { @IsEnum(ProjectRole) role: ProjectRole; }

export class CreateGroupDto {
  @IsString() @Length(2, 120) name: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsBoolean() isPrivate?: boolean;
}

export class UpdateGroupDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsBoolean() isPrivate?: boolean;
}

export class AddGroupMemberDto {
  @IsUUID() projectMembershipId: string;
  @IsEnum(GroupRole) role: GroupRole;
}

export class ChangeGroupRoleDto { @IsEnum(GroupRole) role: GroupRole; }
