import {
  FeedPostType,
  GroupRole,
  IssuePriority,
  IssueStatus,
  OrganizationRole,
  PrismaClient,
  ProjectRole,
  ProjectStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: "10000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "10000000-0000-4000-8000-000000000001",
      name: "PROJECT HUB 데모 조직",
    },
  });

  const partnerOrganization = await prisma.organization.upsert({
    where: { id: "10000000-0000-4000-8000-000000000002" },
    update: {},
    create: { id: "10000000-0000-4000-8000-000000000002", name: "한빛건설" },
  });

  const clientAdmin = await prisma.user.upsert({
    where: { email: "admin@projecthub.local" },
    update: {},
    create: {
      id: "20000000-0000-4000-8000-000000000001",
      email: "admin@projecthub.local",
      name: "김지훈",
      passwordHash: "LOCAL_LOGIN_NOT_ENABLED",
    },
  });
  const contractor = await prisma.user.upsert({
    where: { email: "partner@projecthub.local" },
    update: {},
    create: {
      id: "20000000-0000-4000-8000-000000000002",
      email: "partner@projecthub.local",
      name: "박민수",
      passwordHash: "LOCAL_LOGIN_NOT_ENABLED",
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: clientAdmin.id,
      },
    },
    update: { role: OrganizationRole.ORG_OWNER, status: "ACTIVE" },
    create: {
      organizationId: organization.id,
      userId: clientAdmin.id,
      role: OrganizationRole.ORG_OWNER,
    },
  });
  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: partnerOrganization.id,
        userId: contractor.id,
      },
    },
    update: { status: "ACTIVE" },
    create: {
      organizationId: partnerOrganization.id,
      userId: contractor.id,
      role: OrganizationRole.ORG_MEMBER,
    },
  });

  const project = await prisma.project.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "DEMO-001",
      },
    },
    update: {},
    create: {
      id: "30000000-0000-4000-8000-000000000001",
      organizationId: organization.id,
      code: "DEMO-001",
      name: "통합 업무 기반 구축",
      description: "PROJECT HUB 로컬 개발 환경의 데모 프로젝트입니다.",
      status: ProjectStatus.ACTIVE,
    },
  });

  const adminMembership = await prisma.projectMembership.upsert({
    where: {
      projectId_userId: { projectId: project.id, userId: clientAdmin.id },
    },
    update: {
      role: ProjectRole.CLIENT_ADMIN,
      organizationId: organization.id,
      status: "ACTIVE",
    },
    create: {
      projectId: project.id,
      userId: clientAdmin.id,
      organizationId: organization.id,
      role: ProjectRole.CLIENT_ADMIN,
    },
  });
  const partnerMembership = await prisma.projectMembership.upsert({
    where: {
      projectId_userId: { projectId: project.id, userId: contractor.id },
    },
    update: {
      role: ProjectRole.EXTERNAL_PARTNER,
      organizationId: partnerOrganization.id,
      status: "ACTIVE",
    },
    create: {
      projectId: project.id,
      userId: contractor.id,
      organizationId: partnerOrganization.id,
      role: ProjectRole.EXTERNAL_PARTNER,
    },
  });

  const groupDefinitions = [
    [
      "40000000-0000-4000-8000-000000000001",
      "설계 관리",
      "설계 검토와 도면 협의를 위한 그룹입니다.",
    ],
    [
      "40000000-0000-4000-8000-000000000002",
      "시공 관리",
      "현장 공정과 품질 이슈를 관리하는 그룹입니다.",
    ],
    [
      "40000000-0000-4000-8000-000000000003",
      "기획 관리",
      "사업 기획과 의사결정을 관리하는 그룹입니다.",
    ],
    [
      "40000000-0000-4000-8000-000000000004",
      "공지 사항",
      "프로젝트 전체 공지와 안내를 공유하는 그룹입니다.",
    ],
  ] as const;
  const groups = [];
  for (const [id, name, description] of groupDefinitions) {
    const collaborationGroup = await prisma.collaborationGroup.upsert({
      where: { id },
      update: { name, description },
      create: {
        id,
        projectId: project.id,
        name,
        description,
        isPrivate: true,
        createdById: clientAdmin.id,
      },
    });
    groups.push(collaborationGroup);
    await prisma.groupMembership.upsert({
      where: {
        groupId_projectMembershipId: {
          groupId: collaborationGroup.id,
          projectMembershipId: adminMembership.id,
        },
      },
      update: { role: GroupRole.GROUP_ADMIN },
      create: {
        groupId: collaborationGroup.id,
        projectMembershipId: adminMembership.id,
        role: GroupRole.GROUP_ADMIN,
      },
    });
    await prisma.groupMembership.upsert({
      where: {
        groupId_projectMembershipId: {
          groupId: collaborationGroup.id,
          projectMembershipId: partnerMembership.id,
        },
      },
      update: { role: GroupRole.MEMBER },
      create: {
        groupId: collaborationGroup.id,
        projectMembershipId: partnerMembership.id,
        role: GroupRole.MEMBER,
      },
    });
  }
  for (const name of [
    "01_사업관리",
    "02_토지계약",
    "03_인허가",
    "04_설계도면",
    "05_금융PF",
    "06_계약발주",
    "07_공사공정",
    "08_회의록",
  ]) {
    const existingFolder = await prisma.driveFolder.findFirst({
      where: { projectId: project.id, parentId: null, name, deletedAt: null },
    });
    if (!existingFolder)
      await prisma.driveFolder.create({
        data: { projectId: project.id, createdById: clientAdmin.id, name },
      });
  }

  const milestones = [
    ["토지계약", "2026-10-30T00:00:00+09:00"],
    ["인허가 접수", "2026-11-20T00:00:00+09:00"],
    ["건축허가", "2027-02-15T00:00:00+09:00"],
    ["PF 약정", "2027-03-10T00:00:00+09:00"],
    ["착공", "2027-04-01T00:00:00+09:00"],
    ["골조 완료", "2027-12-20T00:00:00+09:00"],
    ["사용승인", "2028-09-15T00:00:00+09:00"],
    ["준공", "2028-10-31T00:00:00+09:00"],
  ] as const;
  for (const [title, startsAtValue] of milestones) {
    const existing = await prisma.calendarEvent.findFirst({
      where: {
        projectId: project.id,
        kind: "MILESTONE",
        milestoneName: title,
        archivedAt: null,
      },
    });
    if (!existing) {
      const startsAt = new Date(startsAtValue);
      const endsAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
      await prisma.calendarEvent.create({
        data: {
          projectId: project.id,
          createdById: clientAdmin.id,
          assigneeId: clientAdmin.id,
          kind: "MILESTONE",
          title,
          milestoneName: title,
          description: `${title} 목표 일정입니다. 프로젝트 상황에 맞게 수정할 수 있습니다.`,
          startsAt,
          endsAt,
          allDay: true,
          reminderMinutes: 10080,
          reminders: {
            create: {
              userId: clientAdmin.id,
              scheduledAt: new Date(startsAt.getTime() - 10080 * 60000),
            },
          },
        },
      });
    }
  }
  const seedPosts: Array<{
    groupIndex: number;
    type: FeedPostType;
    title: string;
    content: string;
    priority: IssuePriority;
    status: IssueStatus;
    tags: string[];
    assigneeId?: string;
    comment?: string;
  }> = [
    {
      groupIndex: 0,
      type: FeedPostType.DECISION,
      title: "분양가·사업비 변동에 따른 수익성 민감도 검토",
      content:
        "기준 분양가와 총사업비 변동 시 목표 사업수익률이 유지되는지 검토가 필요합니다.",
      priority: IssuePriority.HIGH,
      status: IssueStatus.UNDER_REVIEW,
      tags: ["사업수지", "민감도", "투자심의"],
      assigneeId: contractor.id,
      comment: "금융비용 상승 시나리오를 추가해 투자심의 자료로 정리하겠습니다.",
    },
    {
      groupIndex: 0,
      type: FeedPostType.QUESTION,
      title: "적정 분양가 및 상품 구성 가정 확인",
      content:
        "시장조사 결과를 반영한 평형별 적정 분양가와 상품 구성 가정을 최종 확인해 주세요.",
      priority: IssuePriority.NORMAL,
      status: IssueStatus.IN_PROGRESS,
      tags: ["분양가", "상품기획", "시장조사"],
      comment: "인근 경쟁사업지의 최근 계약률과 함께 비교하겠습니다.",
    },
    {
      groupIndex: 0,
      type: FeedPostType.DECISION,
      title: "주거·상업시설 개발비중 1차안 확정",
      content:
        "시설별 매출과 운영수익을 비교해 주거·상업시설 개발비중 1차안을 확정했습니다.",
      priority: IssuePriority.NORMAL,
      status: IssueStatus.COMPLETED,
      tags: ["개발계획", "시설비중", "결정사항"],
    },
    {
      groupIndex: 1,
      type: FeedPostType.DECISION,
      title: "토지비 조달 및 브릿지론 구조 비교안",
      content:
        "자기자본 투입 비율과 브릿지론 만기 조건별 자금조달안을 비교했습니다.",
      priority: IssuePriority.CRITICAL,
      status: IssueStatus.UNDER_REVIEW,
      tags: ["금융PF", "브릿지론", "자금조달"],
      assigneeId: contractor.id,
      comment: "책임준공 조건과 중도상환수수료를 동일 기준으로 환산하겠습니다.",
    },
    {
      groupIndex: 1,
      type: FeedPostType.GENERAL,
      title: "월간 자금수지 및 집행계획",
      content:
        "토지비, 금융비용, 용역비 집행실적과 다음 달 자금 소요계획을 공유합니다.",
      priority: IssuePriority.NORMAL,
      status: IssueStatus.IN_PROGRESS,
      tags: ["자금수지", "집행계획", "현금흐름"],
    },
    {
      groupIndex: 1,
      type: FeedPostType.ISSUE,
      title: "공사비 상승분 반영 사업성 재검토",
      content:
        "최근 견적 상승분을 총사업비에 반영할 경우 목표 수익률 하락폭과 절감 대안을 검토해 주세요.",
      priority: IssuePriority.HIGH,
      status: IssueStatus.ON_HOLD,
      tags: ["사업비", "수익률", "원가절감"],
    },
    {
      groupIndex: 2,
      type: FeedPostType.DECISION,
      title: "분양 일정 조정안 의사결정",
      content:
        "인허가 보완 일정을 반영하여 홍보관 개관과 분양 일정을 2주 순연하기로 결정했습니다.",
      priority: IssuePriority.HIGH,
      status: IssueStatus.COMPLETED,
      tags: ["분양", "사업일정", "의사결정"],
    },
    {
      groupIndex: 2,
      type: FeedPostType.QUESTION,
      title: "PF 약정 선행조건 자료 요청",
      content:
        "금융기관 검토를 위해 토지확보율, 인허가 현황, 공사비 검증자료 최신본을 요청드립니다.",
      priority: IssuePriority.NORMAL,
      status: IssueStatus.UNDER_REVIEW,
      tags: ["금융PF", "선행조건", "자료요청"],
      assigneeId: clientAdmin.id,
    },
    {
      groupIndex: 2,
      type: FeedPostType.GENERAL,
      title: "사업수지 민감도 분석 공유",
      content:
        "공사비와 분양가 변동률에 따른 사업수지 민감도 분석 결과를 공유합니다.",
      priority: IssuePriority.NORMAL,
      status: IssueStatus.IN_PROGRESS,
      tags: ["사업수지", "공사비", "분양가"],
    },
    {
      groupIndex: 3,
      type: FeedPostType.NOTICE,
      title: "프로젝트 정기회의 운영 안내",
      content:
        "매주 수요일 오후 2시에 주간 프로젝트 정기회의를 진행합니다. 안건은 하루 전까지 등록해 주세요.",
      priority: IssuePriority.HIGH,
      status: IssueStatus.REGISTERED,
      tags: ["공지", "정기회의"],
    },
    {
      groupIndex: 3,
      type: FeedPostType.NOTICE,
      title: "공유 드라이브 문서명 작성 기준",
      content:
        "문서명은 날짜_공종_문서명_버전 순서로 작성하고 승인본은 승인완료 폴더에 보관해 주세요.",
      priority: IssuePriority.NORMAL,
      status: IssueStatus.REGISTERED,
      tags: ["공지", "문서관리", "파일명"],
    },
    {
      groupIndex: 3,
      type: FeedPostType.NOTICE,
      title: "현장 안전교육 일정 안내",
      content:
        "신규 참여자 대상 현장 안전교육을 11월 2일 오전 9시에 진행합니다.",
      priority: IssuePriority.NORMAL,
      status: IssueStatus.REGISTERED,
      tags: ["공지", "안전교육", "일정"],
    },
  ];
  for (const post of seedPosts) {
    const targetGroup = groups[post.groupIndex]!;
    const existingPost = await prisma.feedPost.findFirst({
      where: {
        projectId: project.id,
        groupId: targetGroup.id,
        title: post.title,
      },
    });
    if (!existingPost)
      await prisma.feedPost.create({
        data: {
          projectId: project.id,
          groupId: targetGroup.id,
          authorId: clientAdmin.id,
          assigneeId: post.assigneeId,
          type: post.type,
          title: post.title,
          content: post.content,
          priority: post.priority,
          status: post.status,
          tags: post.tags,
          comments: post.comment
            ? {
                create: {
                  projectId: project.id,
                  groupId: targetGroup.id,
                  authorId: contractor.id,
                  content: post.comment,
                },
              }
            : undefined,
        },
      });
  }
}

main()
  .then(() => console.log("개발용 시드 데이터가 준비되었습니다."))
  .catch((error: unknown) => {
    console.error("개발용 시드 데이터 생성에 실패했습니다.", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
