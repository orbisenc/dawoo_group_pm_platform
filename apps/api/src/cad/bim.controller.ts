import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { CurrentActor } from "../auth/current-actor.decorator";
import type { Actor } from "../projects/collaboration.types";
import { BimTicketQueryDto, CompleteBimUploadDto, PrepareBimUploadDto } from "./bim.dto";
import { CadService } from "./cad.service";

@Controller("projects/:projectId/bim")
@UseGuards(ApiAuthGuard)
export class BimController {
  constructor(private readonly models: CadService) {}

  @Get("configuration")
  configuration(@CurrentActor() actor: Actor, @Param("projectId") projectId: string) {
    return this.models.bimConfiguration(actor, projectId);
  }

  @Post("uploads/prepare")
  prepareUpload(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Body() dto: PrepareBimUploadDto) {
    return this.models.prepareBimUpload(actor, projectId, dto);
  }

  @Post("uploads/complete")
  completeUpload(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Body() dto: CompleteBimUploadDto) {
    return this.models.completeBimUpload(actor, projectId, dto.ticket);
  }

  @Get("status")
  status(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Query() query: BimTicketQueryDto) {
    return this.models.bimStatus(actor, projectId, query.ticket);
  }

  @Get("viewer-token")
  viewerToken(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Query() query: BimTicketQueryDto) {
    return this.models.bimViewerToken(actor, projectId, query.ticket);
  }
}
