import { FeedPostType, IssuePriority, IssueStatus } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from "class-validator";

export class CreateFeedPostDto {
  @IsEnum(FeedPostType) type: FeedPostType;
  @IsString() @Length(2, 200) title: string;
  @IsString() @Length(1, 20000) content: string;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsEnum(IssuePriority) priority?: IssuePriority;
  @IsOptional() @IsEnum(IssueStatus) status?: IssueStatus;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(30, { each: true }) @Matches(/^[\p{L}\p{N}_-]+$/u, { each: true }) tags?: string[];
}

export class UpdateFeedPostDto {
  @IsOptional() @IsEnum(FeedPostType) type?: FeedPostType;
  @IsOptional() @IsString() @Length(2, 200) title?: string;
  @IsOptional() @IsString() @Length(1, 20000) content?: string;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsEnum(IssuePriority) priority?: IssuePriority;
  @IsOptional() @IsEnum(IssueStatus) status?: IssueStatus;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(30, { each: true }) @Matches(/^[\p{L}\p{N}_-]+$/u, { each: true }) tags?: string[];
}

export class FeedFilterDto {
  @IsOptional() @Transform(({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value) @IsString() @MaxLength(100) query?: string;
  @IsOptional() @IsEnum(FeedPostType) type?: FeedPostType;
  @IsOptional() @IsEnum(IssueStatus) status?: IssueStatus;
  @IsOptional() @IsEnum(IssuePriority) priority?: IssuePriority;
  @IsOptional() @IsString() @MaxLength(30) @Matches(/^[\p{L}\p{N}_-]+$/u) tag?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}

export class CreateCommentDto {
  @IsString() @Length(1, 4000) content: string;
  @IsOptional() @IsUUID() parentId?: string;
}

export class PrepareAttachmentDto {
  @IsString() @Length(1, 255) originalName: string;
  @IsString() @MaxLength(150) mimeType: string;
  @IsInt() @Min(1) @Max(52428800) size: number;
}
