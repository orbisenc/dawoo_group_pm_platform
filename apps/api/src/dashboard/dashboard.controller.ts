import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { CurrentActor } from "../auth/current-actor.decorator";
import type { Actor } from "../projects/collaboration.types";
import { DashboardService } from "./dashboard.service";
import { DashboardQueryDto, GlobalSearchDto } from "./dashboard.dto";

@Controller()
@UseGuards(ApiAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("dashboard")
  getDashboard(
    @CurrentActor() actor: Actor,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboard.getDashboard(actor, query.projectId);
  }

  @Get("search")
  search(@CurrentActor() actor: Actor, @Query() query: GlobalSearchDto) {
    return this.dashboard.search(actor, query);
  }
}
