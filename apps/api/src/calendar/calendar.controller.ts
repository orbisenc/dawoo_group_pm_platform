import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { CurrentActor } from "../auth/current-actor.decorator";
import type { Actor } from "../projects/collaboration.types";
import { CalendarFilterDto, CreateCalendarEventDto, PrepareCalendarAttachmentDto, UpdateCalendarEventDto } from "./calendar.dto";
import { CalendarService } from "./calendar.service";

@Controller("projects/:projectId/calendar")
@UseGuards(ApiAuthGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get() list(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Query() query: CalendarFilterDto) { return this.calendar.list(actor, projectId, query); }
  @Get("context") context(@CurrentActor() actor: Actor, @Param("projectId") projectId: string) { return this.calendar.context(actor, projectId); }
  @Get("reminders") reminders(@CurrentActor() actor: Actor, @Param("projectId") projectId: string) { return this.calendar.listReminders(actor, projectId); }
  @Patch("reminders/:reminderId/read") readReminder(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("reminderId") reminderId: string) { return this.calendar.readReminder(actor, projectId, reminderId); }
  @Post() create(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Body() dto: CreateCalendarEventDto) { return this.calendar.create(actor, projectId, dto); }
  @Get(":eventId") get(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("eventId") eventId: string) { return this.calendar.get(actor, projectId, eventId); }
  @Patch(":eventId") update(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("eventId") eventId: string, @Body() dto: UpdateCalendarEventDto) { return this.calendar.update(actor, projectId, eventId, dto); }
  @Delete(":eventId") archive(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("eventId") eventId: string) { return this.calendar.archive(actor, projectId, eventId); }
  @Post(":eventId/attachments/prepare") prepareAttachment(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("eventId") eventId: string, @Body() dto: PrepareCalendarAttachmentDto) { return this.calendar.prepareAttachment(actor, projectId, eventId, dto); }
  @Post(":eventId/attachments/:attachmentId/complete") completeAttachment(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("eventId") eventId: string, @Param("attachmentId") attachmentId: string) { return this.calendar.completeAttachment(actor, projectId, eventId, attachmentId); }
  @Get(":eventId/attachments/:attachmentId/download") downloadAttachment(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("eventId") eventId: string, @Param("attachmentId") attachmentId: string) { return this.calendar.downloadAttachment(actor, projectId, eventId, attachmentId); }
}
