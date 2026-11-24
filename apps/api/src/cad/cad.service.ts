import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Actor } from "../projects/collaboration.types";
import { CollaborationService } from "../projects/collaboration.service";
import type { PrepareCadUploadDto } from "./cad.dto";
import type { PrepareBimUploadDto } from "./bim.dto";

const APS_BASE_URL = "https://developer.api.autodesk.com";
const PART_SIZE = 5 * 1024 * 1024;
const MAX_PARTS = 25;
const UPLOAD_TICKET_LIFETIME_SECONDS = 60 * 60;
const MODEL_TICKET_LIFETIME_SECONDS = 12 * 60 * 60;
const ALLOWED_CAD_MIME_TYPES = new Set([
  "application/octet-stream",
  "application/acad",
  "application/x-acad",
  "image/vnd.dwg",
  "application/dwg",
  "application/dxf",
  "application/x-dxf",
  "image/vnd.dxf",
]);
const ALLOWED_BIM_MIME_TYPES = new Set([
  "application/octet-stream",
  "application/step",
  "application/ifc",
  "application/vnd.sketchup.skp",
  "model/ifc",
  "model/obj",
  "model/step",
  "text/plain",
]);

type ApsToken = { access_token: string; expires_in: number };
type CachedToken = { accessToken: string; expiresAt: number };
type SignedUpload = {
  uploadKey: string;
  urls: string[];
  uploadExpiration: string;
  urlExpiration: string;
};
type CompletedUpload = { objectId: string; objectKey: string; size: number };
type UploadTicket = {
  type: "cad-upload" | "bim-upload";
  projectId: string;
  objectKey: string;
  uploadKey: string;
  fileName: string;
  size: number;
  contentType: string;
  exp: number;
};
type ModelTicket = {
  type: "cad-model" | "bim-model";
  projectId: string;
  urn: string;
  fileName: string;
  exp: number;
};
type ApsManifest = {
  status?: "pending" | "inprogress" | "success" | "failed" | "timeout";
  progress?: string;
  messages?: Array<{ message?: string; type?: string }>;
};

@Injectable()
export class CadService {
  private readonly tokens = new Map<string, CachedToken>();

  constructor(
    private readonly config: ConfigService,
    private readonly collaboration: CollaborationService,
  ) {}

  async configuration(actor: Actor, projectId: string) {
    await this.collaboration.authorizeProject(actor, projectId, false);
    return {
      configured: this.isConfigured(),
      provider: "Autodesk APS",
      supportedFormats: ["dwg", "dxf"],
      maxFileSize: PART_SIZE * MAX_PARTS,
    };
  }

  async bimConfiguration(actor: Actor, projectId: string) {
    await this.collaboration.authorizeProject(actor, projectId, false);
    return {
      configured: this.isConfigured(),
      provider: "Autodesk APS",
      supportedFormats: ["ifc", "obj", "stp", "step", "skp"],
      maxFileSize: PART_SIZE * MAX_PARTS,
    };
  }

  async prepareBimUpload(actor: Actor, projectId: string, dto: PrepareBimUploadDto) {
    await this.collaboration.authorizeProject(actor, projectId, true);
    this.requireConfiguration();
    const extension = this.bimExtension(dto.fileName);
    const contentType = (dto.contentType || "application/octet-stream").toLowerCase();
    if (!ALLOWED_BIM_MIME_TYPES.has(contentType)) {
      throw new BadRequestException("3D 모델의 파일 형식이 올바르지 않습니다.");
    }
    return this.prepareSignedUpload(projectId, dto, extension, "bim-upload", "bim");
  }

  async completeBimUpload(actor: Actor, projectId: string, signedTicket: string) {
    await this.collaboration.authorizeProject(actor, projectId, true);
    this.requireConfiguration();
    const upload = this.verifyTicket<UploadTicket>(signedTicket, "bim-upload", projectId);
    return this.completeSignedUpload(projectId, upload, "bim-model", "3d");
  }

  async bimStatus(actor: Actor, projectId: string, signedTicket: string) {
    return this.modelStatus(actor, projectId, signedTicket, "bim-model");
  }

  async bimViewerToken(actor: Actor, projectId: string, signedTicket: string) {
    return this.modelViewerToken(actor, projectId, signedTicket, "bim-model");
  }

  async prepareUpload(actor: Actor, projectId: string, dto: PrepareCadUploadDto) {
    await this.collaboration.authorizeProject(actor, projectId, true);
    this.requireConfiguration();
    const extension = this.extension(dto.fileName);
    const contentType = (dto.contentType || "application/octet-stream").toLowerCase();
    if (!ALLOWED_CAD_MIME_TYPES.has(contentType)) {
      throw new BadRequestException("DWG 또는 DXF 파일 형식이 올바르지 않습니다.");
    }
    const partCount = Math.ceil(dto.size / PART_SIZE);
    if (partCount > MAX_PARTS) {
      throw new BadRequestException("CAD 파일은 최대 125MB까지 열 수 있습니다.");
    }

    const token = await this.accessToken("bucket:create bucket:read data:create data:write data:read");
    const bucketKey = this.bucketKey();
    await this.ensureBucket(token, bucketKey);
    const fingerprint = createHash("sha256")
      .update(`${projectId}:${dto.sourceId}:${dto.modifiedTime}:${dto.size}`)
      .digest("hex");
    const objectKey = `cad/${projectId}/${fingerprint}.${extension}`;
    const params = new URLSearchParams({ parts: String(partCount), firstPart: "1", minutesExpiration: "10" });
    const upload = await this.apsJson<SignedUpload>(
      `/oss/v2/buckets/${encodeURIComponent(bucketKey)}/objects/${encodeURIComponent(objectKey)}/signeds3upload?${params}`,
      token,
    );
    if (!upload.uploadKey || upload.urls.length !== partCount) {
      throw new BadGatewayException("Autodesk 업로드 주소를 준비하지 못했습니다.");
    }

    const ticket = this.signTicket<UploadTicket>({
      type: "cad-upload",
      projectId,
      objectKey,
      uploadKey: upload.uploadKey,
      fileName: dto.fileName,
      size: dto.size,
      contentType,
      exp: this.nowSeconds() + UPLOAD_TICKET_LIFETIME_SECONDS,
    });
    return {
      ticket,
      urls: upload.urls,
      partSize: PART_SIZE,
      expiresAt: upload.urlExpiration,
    };
  }

  private async prepareSignedUpload(
    projectId: string,
    dto: PrepareBimUploadDto,
    extension: string,
    ticketType: "bim-upload",
    objectPrefix: "bim",
  ) {
    const contentType = (dto.contentType || "application/octet-stream").toLowerCase();
    const partCount = Math.ceil(dto.size / PART_SIZE);
    if (partCount > MAX_PARTS) throw new BadRequestException("3D 모델은 최대 125MB까지 열 수 있습니다.");
    const token = await this.accessToken("bucket:create bucket:read data:create data:write data:read");
    const bucketKey = this.bucketKey();
    await this.ensureBucket(token, bucketKey);
    const fingerprint = createHash("sha256")
      .update(`${projectId}:${dto.sourceId}:${dto.modifiedTime}:${dto.size}`)
      .digest("hex");
    const objectKey = `${objectPrefix}/${projectId}/${fingerprint}.${extension}`;
    const params = new URLSearchParams({ parts: String(partCount), firstPart: "1", minutesExpiration: "10" });
    const upload = await this.apsJson<SignedUpload>(
      `/oss/v2/buckets/${encodeURIComponent(bucketKey)}/objects/${encodeURIComponent(objectKey)}/signeds3upload?${params}`,
      token,
    );
    if (!upload.uploadKey || upload.urls.length !== partCount) {
      throw new BadGatewayException("Autodesk 업로드 주소를 준비하지 못했습니다.");
    }
    return {
      ticket: this.signTicket<UploadTicket>({
        type: ticketType, projectId, objectKey, uploadKey: upload.uploadKey,
        fileName: dto.fileName, size: dto.size, contentType,
        exp: this.nowSeconds() + UPLOAD_TICKET_LIFETIME_SECONDS,
      }),
      urls: upload.urls,
      partSize: PART_SIZE,
      expiresAt: upload.urlExpiration,
    };
  }

  private async completeSignedUpload(
    projectId: string,
    upload: UploadTicket,
    modelType: "bim-model",
    view: "3d",
  ) {
    const token = await this.accessToken("data:create data:write data:read");
    const bucketKey = this.bucketKey();
    const completed = await this.apsJson<CompletedUpload>(
      `/oss/v2/buckets/${encodeURIComponent(bucketKey)}/objects/${encodeURIComponent(upload.objectKey)}/signeds3upload`,
      token,
      { method: "POST", body: JSON.stringify({ uploadKey: upload.uploadKey, size: upload.size, "x-ads-meta-Content-Type": upload.contentType }) },
    );
    if (!completed.objectId) throw new BadGatewayException("Autodesk 저장소에서 업로드 완료를 확인하지 못했습니다.");
    const urn = Buffer.from(completed.objectId).toString("base64url");
    const format: Record<string, unknown> = { type: "svf2", views: [view] };
    if (upload.fileName.toLowerCase().endsWith(".ifc")) format.advanced = { conversionMethod: "v4" };
    await this.apsJson("/modelderivative/v2/designdata/job", token, {
      method: "POST",
      headers: { "x-ads-force": "false", region: this.config.get<string>("APS_REGION", "US") },
      body: JSON.stringify({ input: { urn }, output: { formats: [format] } }),
    });
    return {
      urn,
      ticket: this.signTicket<ModelTicket>({
        type: modelType, projectId, urn, fileName: upload.fileName,
        exp: this.nowSeconds() + MODEL_TICKET_LIFETIME_SECONDS,
      }),
      fileName: upload.fileName,
      status: "processing",
    };
  }

  async completeUpload(actor: Actor, projectId: string, signedTicket: string) {
    await this.collaboration.authorizeProject(actor, projectId, true);
    this.requireConfiguration();
    const upload = this.verifyTicket<UploadTicket>(signedTicket, "cad-upload", projectId);
    const token = await this.accessToken("data:create data:write data:read");
    const bucketKey = this.bucketKey();
    const completed = await this.apsJson<CompletedUpload>(
      `/oss/v2/buckets/${encodeURIComponent(bucketKey)}/objects/${encodeURIComponent(upload.objectKey)}/signeds3upload`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          uploadKey: upload.uploadKey,
          size: upload.size,
          "x-ads-meta-Content-Type": upload.contentType,
        }),
      },
    );
    if (!completed.objectId) {
      throw new BadGatewayException("Autodesk 저장소에서 업로드 완료를 확인하지 못했습니다.");
    }

    const urn = Buffer.from(completed.objectId).toString("base64url");
    await this.apsJson(
      "/modelderivative/v2/designdata/job",
      token,
      {
        method: "POST",
        headers: {
          "x-ads-force": "false",
          region: this.config.get<string>("APS_REGION", "US"),
        },
        body: JSON.stringify({
          input: { urn },
          output: { formats: [{ type: "svf2", views: ["2d"] }] },
        }),
      },
    );

    return {
      urn,
      ticket: this.signTicket<ModelTicket>({
        type: "cad-model",
        projectId,
        urn,
        fileName: upload.fileName,
        exp: this.nowSeconds() + MODEL_TICKET_LIFETIME_SECONDS,
      }),
      fileName: upload.fileName,
      status: "processing",
    };
  }

  async status(actor: Actor, projectId: string, signedTicket: string) {
    return this.modelStatus(actor, projectId, signedTicket, "cad-model");
  }

  private async modelStatus(actor: Actor, projectId: string, signedTicket: string, type: "cad-model" | "bim-model") {
    await this.collaboration.authorizeProject(actor, projectId, false);
    this.requireConfiguration();
    const model = this.verifyTicket<ModelTicket>(signedTicket, type, projectId);
    const token = await this.accessToken("data:read viewables:read");
    const response = await fetch(`${APS_BASE_URL}/modelderivative/v2/designdata/${encodeURIComponent(model.urn)}/manifest`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (response.status === 404) {
      return { status: "pending", progress: "0%", fileName: model.fileName };
    }
    if (!response.ok) throw new BadGatewayException("Autodesk 변환 상태를 확인하지 못했습니다.");
    const manifest = await response.json() as ApsManifest;
    return {
      status: manifest.status ?? "pending",
      progress: manifest.progress ?? "0%",
      fileName: model.fileName,
      messages: manifest.status === "failed"
        ? (manifest.messages ?? []).map((message) => message.message).filter(Boolean)
        : undefined,
    };
  }

  async viewerToken(actor: Actor, projectId: string, signedTicket: string) {
    return this.modelViewerToken(actor, projectId, signedTicket, "cad-model");
  }

  private async modelViewerToken(actor: Actor, projectId: string, signedTicket: string, type: "cad-model" | "bim-model") {
    await this.collaboration.authorizeProject(actor, projectId, false);
    this.requireConfiguration();
    this.verifyTicket<ModelTicket>(signedTicket, type, projectId);
    const token = await this.accessTokenResponse("viewables:read");
    return { access_token: token.access_token, expires_in: token.expires_in };
  }

  private isConfigured() {
    return Boolean(
      this.config.get<string>("APS_CLIENT_ID")?.trim() &&
      this.config.get<string>("APS_CLIENT_SECRET")?.trim(),
    );
  }

  private requireConfiguration() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "Autodesk APS 연결이 설정되지 않았습니다. 서버 환경변수를 확인해 주세요.",
      );
    }
  }

  private extension(fileName: string) {
    const extension = fileName.split(".").pop()?.toLowerCase();
    if (extension !== "dwg" && extension !== "dxf") {
      throw new BadRequestException("DWG 또는 DXF 파일만 열 수 있습니다.");
    }
    return extension;
  }

  private bimExtension(fileName: string) {
    const extension = fileName.split(".").pop()?.toLowerCase();
    if (!extension || !["ifc", "obj", "stp", "step", "skp"].includes(extension)) {
      throw new BadRequestException("IFC, OBJ, STP, STEP 또는 SKP 파일만 열 수 있습니다.");
    }
    return extension;
  }

  private bucketKey() {
    const configured = this.config.get<string>("APS_BUCKET_KEY")?.trim().toLowerCase();
    if (configured) return configured;
    const clientId = this.config.getOrThrow<string>("APS_CLIENT_ID");
    return `project-hub-${createHash("sha256").update(clientId).digest("hex").slice(0, 24)}`;
  }

  private async ensureBucket(token: string, bucketKey: string) {
    const detailsResponse = await fetch(
      `${APS_BASE_URL}/oss/v2/buckets/${encodeURIComponent(bucketKey)}/details`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (detailsResponse.ok) return;
    if (detailsResponse.status !== 404) {
      throw new BadGatewayException("Autodesk CAD 저장소를 확인하지 못했습니다.");
    }

    const createResponse = await fetch(`${APS_BASE_URL}/oss/v2/buckets`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-ads-region": this.config.get<string>("APS_REGION", "US"),
      },
      body: JSON.stringify({ bucketKey, policyKey: "persistent" }),
    });
    if (createResponse.ok || createResponse.status === 409) return;
    throw new BadGatewayException("Autodesk CAD 저장소를 준비하지 못했습니다.");
  }

  private async accessToken(scopes: string) {
    return (await this.accessTokenResponse(scopes)).access_token;
  }

  private async accessTokenResponse(scopes: string): Promise<ApsToken> {
    const cached = this.tokens.get(scopes);
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return {
        access_token: cached.accessToken,
        expires_in: Math.max(60, Math.floor((cached.expiresAt - Date.now()) / 1000)),
      };
    }
    const clientId = this.config.getOrThrow<string>("APS_CLIENT_ID");
    const clientSecret = this.config.getOrThrow<string>("APS_CLIENT_SECRET");
    const body = new URLSearchParams({ grant_type: "client_credentials", scope: scopes });
    const response = await fetch(`${APS_BASE_URL}/authentication/v2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body,
    });
    if (!response.ok) throw new ServiceUnavailableException("Autodesk APS 인증에 실패했습니다.");
    const token = await response.json() as ApsToken;
    this.tokens.set(scopes, {
      accessToken: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    });
    return token;
  }

  private async apsJson<T = Record<string, unknown>>(
    path: string,
    accessToken: string,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${accessToken}`);
    if (init.body) headers.set("content-type", "application/json");
    const response = await fetch(`${APS_BASE_URL}${path}`, { ...init, headers });
    if (!response.ok) {
      throw new BadGatewayException("Autodesk APS 요청을 처리하지 못했습니다.");
    }
    return response.json() as Promise<T>;
  }

  private signTicket<T extends UploadTicket | ModelTicket>(payload: T) {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.ticketSecret()).update(body).digest("base64url");
    return `${body}.${signature}`;
  }

  private verifyTicket<T extends UploadTicket | ModelTicket>(
    ticket: string,
    expectedType: T["type"],
    projectId: string,
  ): T {
    const [body, providedSignature] = ticket.split(".");
    if (!body || !providedSignature) throw new BadRequestException("CAD 작업 정보가 올바르지 않습니다.");
    const expectedSignature = createHmac("sha256", this.ticketSecret()).update(body).digest("base64url");
    const provided = Buffer.from(providedSignature);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new BadRequestException("CAD 작업 정보가 올바르지 않습니다.");
    }
    let payload: T;
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
    } catch {
      throw new BadRequestException("CAD 작업 정보가 올바르지 않습니다.");
    }
    if (payload.type !== expectedType || payload.projectId !== projectId || payload.exp < this.nowSeconds()) {
      throw new BadRequestException("CAD 작업 정보가 만료되었거나 프로젝트와 일치하지 않습니다.");
    }
    return payload;
  }

  private ticketSecret() {
    return this.config.getOrThrow<string>("AUTH_TOKEN_SECRET");
  }

  private nowSeconds() {
    return Math.floor(Date.now() / 1000);
  }
}
