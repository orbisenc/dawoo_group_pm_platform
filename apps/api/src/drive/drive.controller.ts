import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { CurrentActor } from "../auth/current-actor.decorator";
import type { Actor } from "../projects/collaboration.types";
import { CreateDriveFolderDto, DriveListDto, LinkDriveIssueDto, PrepareDriveFileDto, UpdateDriveFileDto, UpdateDriveFolderDto } from "./drive.dto";
import { DriveService } from "./drive.service";

@Controller("projects/:projectId/drive")
@UseGuards(ApiAuthGuard)
export class DriveController {
  constructor(private readonly drive: DriveService) {}

  @Get() list(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Query() query: DriveListDto) { return this.drive.list(actor, projectId, query); }
  @Post("folders") createFolder(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Body() dto: CreateDriveFolderDto) { return this.drive.createFolder(actor, projectId, dto); }
  @Patch("folders/:folderId") updateFolder(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("folderId") folderId: string, @Body() dto: UpdateDriveFolderDto) { return this.drive.updateFolder(actor, projectId, folderId, dto); }
  @Delete("folders/:folderId") deleteFolder(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("folderId") folderId: string) { return this.drive.deleteFolder(actor, projectId, folderId); }
  @Post("files/prepare") prepareFile(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Body() dto: PrepareDriveFileDto) { return this.drive.prepareFile(actor, projectId, dto); }
  @Post("files/:fileId/versions/:versionId/complete") completeFile(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("fileId") fileId: string, @Param("versionId") versionId: string) { return this.drive.completeFile(actor, projectId, fileId, versionId); }
  @Get("files/:fileId/download") downloadFile(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("fileId") fileId: string) { return this.drive.downloadFile(actor, projectId, fileId); }
  @Get("files/:fileId/preview") previewFile(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("fileId") fileId: string) { return this.drive.previewFile(actor, projectId, fileId); }
  @Get("files/:fileId/versions") versions(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("fileId") fileId: string) { return this.drive.listVersions(actor, projectId, fileId); }
  @Patch("files/:fileId") updateFile(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("fileId") fileId: string, @Body() dto: UpdateDriveFileDto) { return this.drive.updateFile(actor, projectId, fileId, dto); }
  @Delete("files/:fileId") deleteFile(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("fileId") fileId: string) { return this.drive.deleteFile(actor, projectId, fileId); }
  @Post("files/:fileId/issues") linkIssue(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("fileId") fileId: string, @Body() dto: LinkDriveIssueDto) { return this.drive.linkIssue(actor, projectId, fileId, dto.postId); }
  @Delete("files/:fileId/issues/:postId") unlinkIssue(@CurrentActor() actor: Actor, @Param("projectId") projectId: string, @Param("fileId") fileId: string, @Param("postId") postId: string) { return this.drive.unlinkIssue(actor, projectId, fileId, postId); }
}
