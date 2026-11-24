import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { CurrentActor } from "../auth/current-actor.decorator";
import type { Actor } from "../projects/collaboration.types";
import { CadTicketQueryDto, CompleteCadUploadDto, PrepareCadUploadDto } from "./cad.dto";
import { CadService } from "./cad.service";

@Controller("projects/:projectId/cad")
@UseGuards(ApiAuthGuard)
export class CadController {
  constructor(private readonly cad: CadService) {}

  @Get("configuration")
  configuration(@CurrentActor() actor: Actor, @Param("projectId") projectId: string) {
    return this.cad.configuration(actor, projectId);
  }

  @Post("uploads/prepare")
  prepareUpload(
    @CurrentActor() actor: Actor,
    @Param("projectId") projectId: string,
    @Body() dto: PrepareCadUploadDto,
  ) {
    return this.cad.prepareUpload(actor, projectId, dto);
  }

  @Post("uploads/complete")
  completeUpload(
    @CurrentActor() actor: Actor,
    @Param("projectId") projectId: string,
    @Body() dto: CompleteCadUploadDto,
  ) {
    return this.cad.completeUpload(actor, projectId, dto.ticket);
  }

  @Get("status")
  status(
    @CurrentActor() actor: Actor,
    @Param("projectId") projectId: string,
    @Query() query: CadTicketQueryDto,
  ) {
    return this.cad.status(actor, projectId, query.ticket);
  }

  @Get("viewer-token")
  viewerToken(
    @CurrentActor() actor: Actor,
    @Param("projectId") projectId: string,
    @Query() query: CadTicketQueryDto,
  ) {
    return this.cad.viewerToken(actor, projectId, query.ticket);
  }
}
