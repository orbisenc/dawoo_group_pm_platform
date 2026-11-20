import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { Observable } from "rxjs";
import { concatMap, from, of } from "rxjs";

import { PrismaService } from "../database/prisma.service";
import { RequestContextService } from "./request-context.service";

type AuditRequest = {
  method: string;
  originalUrl?: string;
  url?: string;
  params?: Record<string, string | undefined>;
  user?: { id?: string };
};

type AuditEvent = {
  action: string;
  projectId: string;
  resourceId: string;
  resourceType: string;
  summary: Prisma.InputJsonObject;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const request = context.switchToHttp().getRequest<AuditRequest>();

    return next.handle().pipe(
      concatMap((response: unknown) => {
        const event = this.resolveEvent(request, response);
        const actorId = request.user?.id;
        if (!event || !actorId || !UUID_PATTERN.test(actorId)) return of(response);

        return from(this.write(actorId, event)).pipe(concatMap(() => of(response)));
      }),
    );
  }

  private async write(actorId: string, event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          projectId: event.projectId,
          resourceId: event.resourceId,
          resourceType: event.resourceType,
          action: event.action,
          requestId: this.requestContext.getRequestId(),
          summary: event.summary,
        },
      });
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        event: "audit_log_write_failed",
        requestId: this.requestContext.getRequestId(),
        action: event.action,
        projectId: event.projectId,
        error: error instanceof Error ? error.name : "UnknownError",
      }));
    }
  }

  private resolveEvent(request: AuditRequest, response: unknown): AuditEvent | null {
    const method = request.method.toUpperCase();
    const path = (request.originalUrl ?? request.url ?? "").split("?")[0] ?? "";

    if (!path.includes("/projects") || path.includes("/approvals")) return null;
    const isFileAccess = method === "GET" && /\/(download|preview)$/.test(path);
    if (!MUTATION_METHODS.has(method) && !isFileAccess) return null;
    if (/\/(notifications|reminders)\/[^/]+\/read$/.test(path)) return null;

    const responseId = this.responseId(response);
    const params = request.params ?? {};
    const projectId = params.projectId ?? (this.isProjectCollection(path) ? responseId : undefined);
    const resourceId = this.lastResourceId(params) ?? responseId ?? projectId;
    if (!projectId || !resourceId || !UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(resourceId)) return null;

    const resourceType = this.resourceType(path);
    return {
      projectId,
      resourceId,
      resourceType,
      action: this.action(method, path, isFileAccess),
      summary: {
        method,
        route: this.normalizePath(path),
      },
    };
  }

  private responseId(response: unknown): string | undefined {
    if (!response || typeof response !== "object" || !("id" in response)) return undefined;
    const id = (response as { id?: unknown }).id;
    return typeof id === "string" ? id : undefined;
  }

  private lastResourceId(params: Record<string, string | undefined>): string | undefined {
    const priority = ["attachmentId", "versionId", "fileId", "postId", "eventId", "groupMemberId", "groupId", "memberId", "projectId"];
    return priority.map((key) => params[key]).find((value) => value !== undefined);
  }

  private isProjectCollection(path: string): boolean {
    return /\/projects\/?$/.test(path);
  }

  private resourceType(path: string): string {
    if (path.includes("/drive/files")) return "DriveFile";
    if (path.includes("/drive/folders")) return "DriveFolder";
    if (path.includes("/attachments")) return "Attachment";
    if (path.includes("/comments")) return "FeedComment";
    if (path.includes("/feed")) return "FeedPost";
    if (path.includes("/calendar")) return "CalendarEvent";
    if (path.includes("/members")) return "ProjectMembership";
    if (path.includes("/groups")) return "CollaborationGroup";
    return "Project";
  }

  private action(method: string, path: string, isFileAccess: boolean): string {
    if (isFileAccess) return path.endsWith("/preview") ? "FILE_PREVIEWED" : "FILE_DOWNLOADED";
    const suffix = method === "POST" ? "CREATED" : method === "DELETE" ? "DELETED" : "UPDATED";
    return `${this.resourceType(path).replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}_${suffix}`;
  }

  private normalizePath(path: string): string {
    return path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":id");
  }
}
