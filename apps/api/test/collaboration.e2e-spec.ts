import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import type { GroupRole, ProjectRole } from "@prisma/client";
import request = require("supertest");

import { ApiAuthGuard } from "../src/auth/api-auth.guard";
import { AuthTokenService } from "../src/auth/auth-token.service";
import { CollaborationController } from "../src/projects/collaboration.controller";
import { CollaborationRepository, type CreateGroupData, type CreateMemberData, type CreateProjectData, type GroupMemberView, type GroupView, type ProjectMemberView, type ProjectView, type UpdateGroupData, type UpdateProjectData } from "../src/projects/collaboration.types";
import { ProjectAccessPolicy } from "../src/projects/project-access.policy";
import { CollaborationService } from "../src/projects/collaboration.service";

const PROJECT_A = "10000000-0000-4000-8000-000000000001";
const PROJECT_B = "10000000-0000-4000-8000-000000000002";
const ORG_A = "20000000-0000-4000-8000-000000000001";
const ORG_B = "20000000-0000-4000-8000-000000000002";
const USER_ADMIN = "30000000-0000-4000-8000-000000000001";
const USER_GROUP_ADMIN = "30000000-0000-4000-8000-000000000002";
const USER_READ_ONLY = "30000000-0000-4000-8000-000000000003";
const USER_PARTNER = "30000000-0000-4000-8000-000000000004";
const MEMBER_ADMIN = "40000000-0000-4000-8000-000000000001";
const MEMBER_GROUP_ADMIN = "40000000-0000-4000-8000-000000000002";
const MEMBER_READ_ONLY = "40000000-0000-4000-8000-000000000003";
const GROUP_A = "50000000-0000-4000-8000-000000000001";
const GROUP_B = "50000000-0000-4000-8000-000000000002";

class MemoryCollaborationRepository extends CollaborationRepository {
  private readonly projects: ProjectView[] = [
    { id: PROJECT_A, organizationId: ORG_A, code: "A", name: "A 프로젝트", description: null, status: "ACTIVE" },
    { id: PROJECT_B, organizationId: ORG_A, code: "B", name: "B 비공개 프로젝트", description: null, status: "ACTIVE" },
  ];
  private readonly members: ProjectMemberView[] = [
    { id: MEMBER_ADMIN, projectId: PROJECT_A, userId: USER_ADMIN, organizationId: ORG_A, role: "CLIENT_ADMIN", status: "ACTIVE" },
    { id: MEMBER_GROUP_ADMIN, projectId: PROJECT_A, userId: USER_GROUP_ADMIN, organizationId: ORG_A, role: "GROUP_ADMIN", status: "ACTIVE" },
    { id: MEMBER_READ_ONLY, projectId: PROJECT_A, userId: USER_READ_ONLY, organizationId: ORG_A, role: "READ_ONLY", status: "ACTIVE" },
  ];
  private readonly groups: GroupView[] = [
    { id: GROUP_A, projectId: PROJECT_A, name: "시행사 전용 그룹", description: null, isPrivate: true, createdById: USER_ADMIN, memberships: [{ id: crypto.randomUUID(), projectMembershipId: MEMBER_ADMIN, role: "GROUP_ADMIN" }] },
    { id: GROUP_B, projectId: PROJECT_B, name: "B 비공개 그룹", description: null, isPrivate: true, createdById: USER_ADMIN, memberships: [] },
  ];

  findActor(userId: string) { return Promise.resolve([USER_ADMIN, USER_GROUP_ADMIN, USER_READ_ONLY, USER_PARTNER].includes(userId) ? { id: userId, isActive: true, platformRole: "USER" as const } : null); }
  findOrganizationRole(userId: string, organizationId: string) { return Promise.resolve(userId === USER_PARTNER && organizationId === ORG_B ? "ORG_MEMBER" as const : null); }
  findProject(projectId: string) { return Promise.resolve(this.projects.find((item) => item.id === projectId) ?? null); }
  createProjectWithAdmin(data: CreateProjectData, adminUserId: string) { void adminUserId; return Promise.resolve({ id: crypto.randomUUID(), description: null, status: "PREPARING" as const, ...data }); }
  updateProject(projectId: string, data: UpdateProjectData) { const project = this.projects.find((item) => item.id === projectId)!; Object.assign(project, data); return Promise.resolve(project); }
  findMembership(projectId: string, userId: string) { return Promise.resolve(this.members.find((item) => item.projectId === projectId && item.userId === userId) ?? null); }
  findMemberById(projectId: string, memberId: string) { return Promise.resolve(this.members.find((item) => item.projectId === projectId && item.id === memberId) ?? null); }
  listMembers(projectId: string) { return Promise.resolve(this.members.filter((item) => item.projectId === projectId)); }
  createMember(data: CreateMemberData) { const member = { id: crypto.randomUUID(), status: "ACTIVE" as const, ...data }; this.members.push(member); return Promise.resolve(member); }
  updateMemberRole(memberId: string, role: ProjectRole) { const member = this.members.find((item) => item.id === memberId)!; member.role = role; return Promise.resolve(member); }
  deactivateMember(memberId: string) { const member = this.members.find((item) => item.id === memberId)!; member.status = "INACTIVE"; return Promise.resolve(member); }
  countActiveProjectAdmins(projectId: string) { return Promise.resolve(this.members.filter((item) => item.projectId === projectId && item.status === "ACTIVE" && item.role === "CLIENT_ADMIN").length); }
  listGroups(projectId: string) { return Promise.resolve(this.groups.filter((item) => item.projectId === projectId)); }
  findGroup(projectId: string, groupId: string) { return Promise.resolve(this.groups.find((item) => item.projectId === projectId && item.id === groupId) ?? null); }
  createGroup(data: CreateGroupData) { const group = { id: crypto.randomUUID(), memberships: [], ...data }; this.groups.push(group); return Promise.resolve(group); }
  updateGroup(groupId: string, data: UpdateGroupData) { const group = this.groups.find((item) => item.id === groupId)!; Object.assign(group, data); return Promise.resolve(group); }
  addGroupMember(_groupId: string, projectMembershipId: string, role: GroupRole) { return Promise.resolve({ id: crypto.randomUUID(), projectMembershipId, role }); }
  updateGroupMemberRole(groupMemberId: string, role: GroupRole): Promise<GroupMemberView> { return Promise.resolve({ id: groupMemberId, projectMembershipId: MEMBER_ADMIN, role }); }
  removeGroupMember() { return Promise.resolve(); }
}

describe("프로젝트 협업 권한 API (e2e)", () => {
  let app: INestApplication;
  let tokens: AuthTokenService;

  beforeAll(async () => {
    const repository = new MemoryCollaborationRepository();
    const module = await Test.createTestingModule({
      controllers: [CollaborationController],
      providers: [
        ApiAuthGuard,
        AuthTokenService,
        CollaborationService,
        ProjectAccessPolicy,
        { provide: ConfigService, useValue: { getOrThrow: () => "e2e-test-auth-secret" } },
        { provide: CollaborationRepository, useValue: repository },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    tokens = module.get(AuthTokenService);
  });

  afterAll(async () => app.close());

  it("인증 정보가 없으면 요청을 거부한다", async () => {
    await request(app.getHttpServer()).get(`/api/v1/projects/${PROJECT_A}`).expect(401);
  });

  it("활성 참여자는 자신의 프로젝트를 조회한다", async () => {
    const response = await request(app.getHttpServer()).get(`/api/v1/projects/${PROJECT_A}`).set("authorization", `Bearer ${tokens.sign(USER_READ_ONLY)}`).expect(200);
    expect(response.body.name).toBe("A 프로젝트");
  });

  it("다른 프로젝트 ID를 직접 입력해도 비공개 데이터가 노출되지 않는다", async () => {
    await request(app.getHttpServer()).get(`/api/v1/projects/${PROJECT_B}`).set("authorization", `Bearer ${tokens.sign(USER_READ_ONLY)}`).expect(404);
  });

  it("URL 프로젝트와 실제 그룹 프로젝트가 다르면 404를 반환한다", async () => {
    await request(app.getHttpServer()).get(`/api/v1/projects/${PROJECT_A}/groups/${GROUP_B}`).set("authorization", `Bearer ${tokens.sign(USER_ADMIN)}`).expect(404);
  });

  it("읽기 전용 사용자의 그룹 생성 API 우회를 차단한다", async () => {
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_A}/groups`).set("authorization", `Bearer ${tokens.sign(USER_READ_ONLY)}`).send({ name: "무단 그룹" }).expect(403);
  });

  it("그룹 관리자는 협업 그룹을 생성할 수 있다", async () => {
    const response = await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_A}/groups`).set("authorization", `Bearer ${tokens.sign(USER_GROUP_ADMIN)}`).send({ name: "설계 협업 그룹", isPrivate: true }).expect(201);
    expect(response.body).toMatchObject({ name: "설계 협업 그룹", projectId: PROJECT_A, isPrivate: true });
  });

  it("그룹 관리자는 자신이 관리자로 지정되지 않은 비공개 그룹을 수정하지 못한다", async () => {
    await request(app.getHttpServer()).patch(`/api/v1/projects/${PROJECT_A}/groups/${GROUP_A}`).set("authorization", `Bearer ${tokens.sign(USER_GROUP_ADMIN)}`).send({ name: "무단 변경" }).expect(403);
  });

  it("시행사 관리자는 다른 참여회사의 사용자를 프로젝트에 초대한다", async () => {
    const response = await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_A}/members`).set("authorization", `Bearer ${tokens.sign(USER_ADMIN)}`).send({ userId: USER_PARTNER, organizationId: ORG_B, role: "EXTERNAL_PARTNER" }).expect(201);
    expect(response.body).toMatchObject({ projectId: PROJECT_A, userId: USER_PARTNER, organizationId: ORG_B, role: "EXTERNAL_PARTNER" });
  });

  it("마지막 시행사 관리자를 제외하지 못한다", async () => {
    await request(app.getHttpServer()).delete(`/api/v1/projects/${PROJECT_A}/members/${MEMBER_ADMIN}`).set("authorization", `Bearer ${tokens.sign(USER_ADMIN)}`).expect(403);
  });

  it("다른 프로젝트 멤버 ID를 협업 그룹에 추가하지 못한다", async () => {
    await request(app.getHttpServer()).post(`/api/v1/projects/${PROJECT_A}/groups/${GROUP_A}/members`).set("authorization", `Bearer ${tokens.sign(USER_ADMIN)}`).send({ projectMembershipId: "40000000-0000-4000-8000-000000000099", role: "MEMBER" }).expect(404);
  });
});
