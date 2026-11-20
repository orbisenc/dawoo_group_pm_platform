import { generateKeyPairSync } from "node:crypto";

import type { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";

import type { PrismaService } from "../database/prisma.service";
import { GoogleDriveInvitationService, isGmailAddress } from "./google-drive-invitation.service";

describe("GoogleDriveInvitationService", () => {
  const upsert = jest.fn();
  const findUnique = jest.fn();
  const findMany = jest.fn();
  const update = jest.fn();
  const prisma = {
    googleDriveInvitation: { upsert, findUnique, findMany, update },
  } as unknown as PrismaService;
  const queueAdd = jest.fn();
  const queueGetJob = jest.fn();
  const queue = { add: queueAdd, getJob: queueGetJob } as unknown as Queue;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const values: Record<string, string> = {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "drive-bot@example.iam.gserviceaccount.com",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    GOOGLE_SHARED_DRIVE_NAME: "다우그룹_공유 드라이브",
  };
  const config = {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
    getOrThrow: (key: string) => {
      if (!values[key]) throw new Error(`missing ${key}`);
      return values[key];
    },
  } as unknown as ConfigService;
  const service = new GoogleDriveInvitationService(prisma, config, queue);

  beforeEach(() => {
    jest.clearAllMocks();
    queueGetJob.mockResolvedValue(undefined);
  });

  it("Gmail과 Googlemail 주소만 자동 초대 대상으로 분류한다", () => {
    expect(isGmailAddress("member@gmail.com")).toBe(true);
    expect(isGmailAddress("member@googlemail.com")).toBe(true);
    expect(isGmailAddress("member@company.com")).toBe(false);
  });

  it("승인된 Gmail 회원을 내구성 있게 저장하고 초대 작업을 등록한다", async () => {
    upsert.mockResolvedValueOnce({ id: "invite-1" });
    queueAdd.mockResolvedValueOnce({ id: "job-1" });

    await service.schedule("user-1", "Member@Gmail.com", "admin-1");

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1" },
      create: expect.objectContaining({ email: "member@gmail.com", requestedById: "admin-1", driveName: "다우그룹_공유 드라이브", role: "writer", status: "PENDING" }),
    }));
    expect(queueAdd).toHaveBeenCalledWith("google-drive-invite", { userId: "user-1" }, expect.objectContaining({ attempts: 5 }));
  });

  it("재시도가 끝난 실패 작업은 제거하고 다시 등록한다", async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    queueGetJob.mockResolvedValueOnce({ getState: jest.fn().mockResolvedValue("failed"), remove });
    upsert.mockResolvedValueOnce({ id: "invite-1" });
    queueAdd.mockResolvedValueOnce({ id: "job-1" });

    await service.schedule("user-1", "member@gmail.com", "admin-1");

    expect(remove).toHaveBeenCalledTimes(1);
    expect(queueAdd).toHaveBeenCalledTimes(1);
  });

  it("대상 공유 드라이브에 편집 가능한 writer 권한을 생성한다", async () => {
    findUnique.mockResolvedValueOnce({
      id: "invite-1",
      userId: "user-1",
      email: "member@gmail.com",
      driveName: "다우그룹_공유 드라이브",
      status: "PENDING",
      user: { isActive: true, approvalStatus: "APPROVED" },
    });
    update.mockResolvedValue({});
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "google-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ drives: [{ id: "drive-1", name: "다우그룹_공유 드라이브" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ permissions: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "permission-1", role: "writer" }), { status: 200 }));

    await service.process("user-1");

    const createPermissionCall = fetchMock.mock.calls[3]!;
    expect(createPermissionCall[0]).toEqual(expect.stringContaining("/drive-1/permissions?"));
    expect(createPermissionCall[1]).toEqual(expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ type: "user", role: "writer", emailAddress: "member@gmail.com" }),
    }));
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "COMPLETED", permissionId: "permission-1" }),
    }));
    fetchMock.mockRestore();
  });
});
