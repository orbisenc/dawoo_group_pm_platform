import { ForbiddenException, Injectable } from "@nestjs/common";
import type { ProjectRole } from "@prisma/client";

const CLIENT_ADMINS = new Set<ProjectRole>(["CLIENT_ADMIN", "PROJECT_ADMIN"]);
const PROJECT_MANAGERS = new Set<ProjectRole>(["PROJECT_PM", "PROJECT_MANAGER"]);
const GROUP_MANAGERS = new Set<ProjectRole>(["GROUP_ADMIN"]);
const LOWER_ROLES = new Set<ProjectRole>(["GROUP_ADMIN", "PARTICIPANT", "EXTERNAL_PARTNER", "READ_ONLY", "CONTRIBUTOR", "REVIEWER", "VIEWER"]);

@Injectable()
export class ProjectAccessPolicy {
  canUpdateProject(role: ProjectRole) { return CLIENT_ADMINS.has(role) || PROJECT_MANAGERS.has(role); }
  canManageAllMembers(role: ProjectRole) { return CLIENT_ADMINS.has(role); }
  canManageLowerMembers(role: ProjectRole) { return PROJECT_MANAGERS.has(role); }
  canManageGroups(role: ProjectRole) { return CLIENT_ADMINS.has(role) || PROJECT_MANAGERS.has(role) || GROUP_MANAGERS.has(role); }
  canSeeAllGroups(role: ProjectRole) { return CLIENT_ADMINS.has(role) || PROJECT_MANAGERS.has(role); }

  assertCanAssignRole(actorRole: ProjectRole, targetRole: ProjectRole) {
    if (this.canManageAllMembers(actorRole)) return;
    if (this.canManageLowerMembers(actorRole) && LOWER_ROLES.has(targetRole)) return;
    throw new ForbiddenException("해당 역할을 부여할 권한이 없습니다.");
  }
}
