import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { CurrentActor } from "../auth/current-actor.decorator";
import type { Actor } from "../projects/collaboration.types";
import { CreateCommentDto, CreateFeedPostDto, FeedFilterDto, PrepareAttachmentDto, UpdateFeedPostDto } from "./feed.dto";
import { FeedService } from "./feed.service";

@Controller("projects/:projectId/groups/:groupId/feed")
@UseGuards(ApiAuthGuard)
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get() list(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string, @Query() query: FeedFilterDto) { return this.feed.list(actor, projectId, groupId, query); }
  @Get("assignees") assignees(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string) { return this.feed.listAssignees(actor, projectId, groupId); }
  @Post() create(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string, @Body() dto: CreateFeedPostDto) { return this.feed.create(actor, projectId, groupId, dto); }
  @Get(":postId") get(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string, @Param("postId") postId: string) { return this.feed.get(actor, projectId, groupId, postId); }
  @Patch(":postId") update(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string, @Param("postId") postId: string, @Body() dto: UpdateFeedPostDto) { return this.feed.update(actor, projectId, groupId, postId, dto); }
  @Delete(":postId") archive(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string, @Param("postId") postId: string) { return this.feed.archive(actor, projectId, groupId, postId); }
  @Post(":postId/comments") comment(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string, @Param("postId") postId: string, @Body() dto: CreateCommentDto) { return this.feed.addComment(actor, projectId, groupId, postId, dto); }
  @Post(":postId/attachments/prepare") prepareAttachment(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string, @Param("postId") postId: string, @Body() dto: PrepareAttachmentDto) { return this.feed.prepareAttachment(actor, projectId, groupId, postId, dto); }
  @Post(":postId/attachments/:attachmentId/complete") completeAttachment(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string, @Param("postId") postId: string, @Param("attachmentId") attachmentId: string) { return this.feed.completeAttachment(actor, projectId, groupId, postId, attachmentId); }
  @Get(":postId/attachments/:attachmentId/download") downloadAttachment(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("groupId") groupId: string, @Param("postId") postId: string, @Param("attachmentId") attachmentId: string) { return this.feed.getAttachmentDownload(actor, projectId, groupId, postId, attachmentId); }
}
