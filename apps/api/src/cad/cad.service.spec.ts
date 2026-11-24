import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";

import type { CollaborationService } from "../projects/collaboration.service";
import { CadService } from "./cad.service";

const actor = { id: "user-1", isActive: true, platformRole: "USER" as const };
const projectId = "30000000-0000-4000-8000-000000000001";

function config(values: Record<string, string> = {}) {
  const all = {
    APS_CLIENT_ID: "aps-client-id",
    APS_CLIENT_SECRET: "aps-client-secret",
    AUTH_TOKEN_SECRET: "test-auth-token-secret-at-least-32-characters",
    APS_BUCKET_KEY: "project-hub-test-cad",
    APS_REGION: "US",
    ...values,
  };
  return {
    get: jest.fn((key: string, fallback?: string) => all[key as keyof typeof all] ?? fallback),
    getOrThrow: jest.fn((key: string) => {
      const value = all[key as keyof typeof all];
      if (!value) throw new Error(`Missing ${key}`);
      return value;
    }),
  } as unknown as ConfigService;
}

describe("CadService Autodesk APS 연동", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("프로젝트 접근 권한을 확인한 뒤 APS 설정 상태를 반환한다", async () => {
    const authorizeProject = jest.fn().mockResolvedValue({ membership: { role: "PARTICIPANT" } });
    const service = new CadService(config({ APS_CLIENT_ID: "", APS_CLIENT_SECRET: "" }), { authorizeProject } as unknown as CollaborationService);

    await expect(service.configuration(actor, projectId)).resolves.toEqual(expect.objectContaining({ configured: false }));
    expect(authorizeProject).toHaveBeenCalledWith(actor, projectId, false);
  });

  it("다른 프로젝트 사용자는 APS 업로드 준비 전에 차단한다", async () => {
    const authorizeProject = jest.fn().mockRejectedValue(new NotFoundException());
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    const service = new CadService(config(), { authorizeProject } as unknown as CollaborationService);

    await expect(service.prepareUpload(actor, "private-project", {
      fileName: "배치도.dwg",
      size: 1024,
      contentType: "application/octet-stream",
      sourceId: "google-file-1",
      modifiedTime: "2026-11-23T00:00:00.000Z",
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("브라우저 직접 업로드용 서명 URL만 발급하고 프로젝트 티켓을 묶는다", async () => {
    const authorizeProject = jest.fn().mockResolvedValue({ membership: { role: "PROJECT_PM" } });
    const fetchMock = jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "aps-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ bucketKey: "project-hub-test-cad" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        uploadKey: "upload-key",
        uploadExpiration: "2026-11-23T01:00:00.000Z",
        urlExpiration: "2026-11-23T00:10:00.000Z",
        urls: ["https://signed-upload.example/part-1"],
      }), { status: 200 }));
    const service = new CadService(config(), { authorizeProject } as unknown as CollaborationService);

    const result = await service.prepareUpload(actor, projectId, {
      fileName: "배치도.dwg",
      size: 1024,
      contentType: "application/octet-stream",
      sourceId: "google-file-1",
      modifiedTime: "2026-11-23T00:00:00.000Z",
    });

    expect(result.urls).toEqual(["https://signed-upload.example/part-1"]);
    expect(result.ticket).toContain(".");
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("/signeds3upload?"),
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    await expect(service.completeUpload(actor, "another-project", result.ticket)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("APS 버킷이 없으면 공식 버킷 생성 API를 사용한다", async () => {
    const authorizeProject = jest.fn().mockResolvedValue({ membership: { role: "PROJECT_PM" } });
    const fetchMock = jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "aps-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ bucketKey: "project-hub-test-cad" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        uploadKey: "upload-key",
        uploadExpiration: "2026-11-23T01:00:00.000Z",
        urlExpiration: "2026-11-23T00:10:00.000Z",
        urls: ["https://signed-upload.example/part-1"],
      }), { status: 200 }));
    const service = new CadService(config(), { authorizeProject } as unknown as CollaborationService);

    await service.prepareUpload(actor, projectId, {
      fileName: "connection-test.dwg",
      size: 1024,
      contentType: "application/octet-stream",
      sourceId: "google-file-2",
      modifiedTime: "2026-11-23T00:00:00.000Z",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/buckets/project-hub-test-cad/details"),
      expect.objectContaining({ headers: { authorization: "Bearer aps-token" } }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringMatching(/\/oss\/v2\/buckets$/),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("BIM 업로드를 프로젝트에 묶고 IFC를 3D v4 변환으로 요청한다", async () => {
    const authorizeProject = jest.fn().mockResolvedValue({ membership: { role: "PROJECT_PM" } });
    const fetchMock = jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "aps-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ bucketKey: "project-hub-test-cad" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        uploadKey: "bim-upload-key",
        urlExpiration: "2026-11-23T00:10:00.000Z",
        urls: ["https://signed-upload.example/bim-part-1"],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "aps-complete-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ objectId: "urn:adsk.objects:os.object:test/model.ifc" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: "success" }), { status: 200 }));
    const service = new CadService(config(), { authorizeProject } as unknown as CollaborationService);

    const prepared = await service.prepareBimUpload(actor, projectId, {
      fileName: "본관.ifc",
      size: 1024,
      contentType: "application/octet-stream",
      sourceId: "google-bim-1",
      modifiedTime: "2026-11-23T00:00:00.000Z",
    });
    const completed = await service.completeBimUpload(actor, projectId, prepared.ticket);

    const [jobUrl, init] = fetchMock.mock.calls[5] as [string, RequestInit];
    expect(jobUrl).toContain("/modelderivative/v2/designdata/job");
    expect(JSON.parse(init.body as string)).toEqual(expect.objectContaining({
      output: { formats: [{ type: "svf2", views: ["3d"], advanced: { conversionMethod: "v4" } }] },
    }));
    await expect(service.bimViewerToken(actor, "another-project", completed.ticket))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
