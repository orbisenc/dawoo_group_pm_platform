import { NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { S3Client } from "@aws-sdk/client-s3";

import type { PrismaService } from "../database/prisma.service";
import type { CollaborationService } from "../projects/collaboration.service";
import { FeedService } from "./feed.service";
import { InputSecurityService } from "./input-security.service";
import type { RealtimeService } from "../realtime/realtime.service";

const actor = { id: "30000000-0000-4000-8000-000000000001", isActive: true, platformRole: "USER" as const };
const projectId = "10000000-0000-4000-8000-000000000001";
const groupId = "20000000-0000-4000-8000-000000000001";

describe("FeedService 프로젝트·그룹 범위", () => {
  const authorizeGroup = jest.fn().mockResolvedValue({ membership: null, group: { memberships: [] } });
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const findFirst = jest.fn().mockResolvedValue(null);
  const create = jest.fn();
  const transaction = jest.fn().mockImplementation((operations: Array<Promise<unknown>>) => Promise.all(operations));
  const prisma = {
    $transaction: transaction,
    feedPost: { findMany, count, findFirst, create },
  } as unknown as PrismaService;
  const service = new FeedService(
    prisma,
    { authorizeGroup } as unknown as CollaborationService,
    new InputSecurityService(),
    new ConfigService({ S3_BUCKET: "test" }),
    {} as S3Client,
    { publish: jest.fn() } as unknown as RealtimeService,
  );

  beforeEach(() => jest.clearAllMocks());

  it("목록 쿼리에 projectId와 groupId를 함께 적용한다", async () => {
    await service.list(actor, projectId, groupId, { page: 1, pageSize: 20 });

    expect(authorizeGroup).toHaveBeenCalledWith(actor, projectId, groupId, false);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ projectId, groupId, archivedAt: null }),
    }));
    expect(count).toHaveBeenCalledWith({ where: expect.objectContaining({ projectId, groupId }) });
  });

  it("다른 그룹의 게시글 ID를 직접 조회해도 404로 숨긴다", async () => {
    await expect(service.get(actor, projectId, groupId, "30000000-0000-4000-8000-000000000099")).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ projectId, groupId }),
    }));
  });

  it("게시글 작성 전에 그룹 쓰기 권한을 검사하고 HTML 본문을 거부한다", async () => {
    await expect(service.create(actor, projectId, groupId, {
      type: "ISSUE", title: "검토 요청", content: "<script>alert(1)</script>",
    })).rejects.toThrow("HTML을 사용할 수 없습니다");
    expect(authorizeGroup).toHaveBeenCalledWith(actor, projectId, groupId, true);
    expect(create).not.toHaveBeenCalled();
  });
});
