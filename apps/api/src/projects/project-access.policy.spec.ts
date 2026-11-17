import { ForbiddenException } from "@nestjs/common";

import { ProjectAccessPolicy } from "./project-access.policy";

describe("ProjectAccessPolicy", () => {
  const policy = new ProjectAccessPolicy();

  it.each([
    ["CLIENT_ADMIN", true, true, true],
    ["PROJECT_PM", true, false, true],
    ["GROUP_ADMIN", false, false, true],
    ["PARTICIPANT", false, false, false],
    ["EXTERNAL_PARTNER", false, false, false],
    ["READ_ONLY", false, false, false],
  ] as const)("%s 역할의 관리 권한을 계산한다", (role, project, members, groups) => {
    expect(policy.canUpdateProject(role)).toBe(project);
    expect(policy.canManageAllMembers(role)).toBe(members);
    expect(policy.canManageGroups(role)).toBe(groups);
  });

  it("프로젝트 PM이 시행사 관리자 역할을 부여하지 못하게 한다", () => {
    expect(() => policy.assertCanAssignRole("PROJECT_PM", "CLIENT_ADMIN")).toThrow(ForbiddenException);
    expect(() => policy.assertCanAssignRole("PROJECT_PM", "PARTICIPANT")).not.toThrow();
  });
});
