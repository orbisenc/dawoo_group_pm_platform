import { Controller, Get, NotFoundException, Param, Patch, UseGuards } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { CurrentActor } from "../auth/current-actor.decorator";
import type { Actor } from "../projects/collaboration.types";
import { RealtimeService } from "./realtime.service";

@Controller("notifications")
@UseGuards(ApiAuthGuard)
export class NotificationController {
  constructor(private readonly realtime: RealtimeService) {}
  @Get("unread") unread(@CurrentActor() actor: Actor) { return this.realtime.listUnread(actor.id); }
  @Patch(":notificationId/read") async read(@CurrentActor() actor: Actor, @Param("notificationId") notificationId: string) {
    const notification = await this.realtime.markRead(actor.id, notificationId);
    if (!notification) throw new NotFoundException("알림을 찾을 수 없습니다.");
    return notification;
  }
}
