import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { CurrentActor } from "../auth/current-actor.decorator";
import type { Actor } from "../projects/collaboration.types";
import { ApprovalDecisionDto, ApprovalListDto, CreateApprovalDto, CreateApprovalRouteTemplateDto, RejectApprovalDto, UpdateApprovalDto, UpdateApprovalRouteTemplateDto } from "./approval.dto";
import { ApprovalService } from "./approval.service";

@Controller("projects/:projectId/approvals")
@UseGuards(ApiAuthGuard)
export class ApprovalController {
  constructor(private readonly approvals: ApprovalService) {}
  @Get() list(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Query() query: ApprovalListDto) { return this.approvals.list(actor, projectId, query); }
  @Get("context") context(@CurrentActor() actor: Actor, @Param("projectId") projectId: string) { return this.approvals.context(actor, projectId); }
  @Get("notifications") notifications(@CurrentActor() actor: Actor, @Param("projectId") projectId: string) { return this.approvals.notifications(actor, projectId); }
  @Patch("notifications/:notificationId/read") readNotification(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("notificationId") notificationId: string) { return this.approvals.readNotification(actor, projectId, notificationId); }
  @Get("route-templates") routeTemplates(@CurrentActor() actor: Actor, @Param("projectId") projectId: string) { return this.approvals.listRouteTemplates(actor, projectId); }
  @Post("route-templates") createRouteTemplate(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Body() dto: CreateApprovalRouteTemplateDto) { return this.approvals.createRouteTemplate(actor, projectId, dto); }
  @Patch("route-templates/:templateId") updateRouteTemplate(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("templateId") templateId: string, @Body() dto: UpdateApprovalRouteTemplateDto) { return this.approvals.updateRouteTemplate(actor, projectId, templateId, dto); }
  @Delete("route-templates/:templateId") deleteRouteTemplate(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("templateId") templateId: string) { return this.approvals.deleteRouteTemplate(actor, projectId, templateId); }
  @Post() create(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Body() dto: CreateApprovalDto) { return this.approvals.create(actor, projectId, dto); }
  @Get(":documentId") detail(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("documentId") documentId: string) { return this.approvals.detail(actor, projectId, documentId); }
  @Patch(":documentId") update(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("documentId") documentId: string, @Body() dto: UpdateApprovalDto) { return this.approvals.update(actor, projectId, documentId, dto); }
  @Post(":documentId/submit") submit(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("documentId") documentId: string) { return this.approvals.submit(actor, projectId, documentId); }
  @Post(":documentId/withdraw") withdraw(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("documentId") documentId: string) { return this.approvals.withdraw(actor, projectId, documentId); }
  @Post(":documentId/approve") approve(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("documentId") documentId: string, @Body() dto: ApprovalDecisionDto) { return this.approvals.approve(actor, projectId, documentId, dto.comment); }
  @Post(":documentId/reject") reject(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("documentId") documentId: string, @Body() dto: RejectApprovalDto) { return this.approvals.reject(actor, projectId, documentId, dto.comment); }
}
