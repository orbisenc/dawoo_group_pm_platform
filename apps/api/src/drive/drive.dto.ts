import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from "class-validator";

export class DriveListDto {
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @Transform(({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value) @IsString() @MaxLength(100) query?: string;
}

export class CreateDriveFolderDto {
  @IsString() @Length(1, 120) name: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsBoolean() isRestricted = false;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsUUID("4", { each: true }) groupIds?: string[];
}

export class UpdateDriveFolderDto {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsBoolean() isRestricted?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsUUID("4", { each: true }) groupIds?: string[];
}

export class PrepareDriveFileDto {
  @IsOptional() @IsUUID() fileId?: string;
  @IsOptional() @IsUUID() folderId?: string;
  @IsString() @Length(1, 255) originalName: string;
  @IsString() @MaxLength(150) mimeType: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1073741824) size: number;
  @IsString() @Matches(/^[a-f0-9]{64}$/u) sha256: string;
}

export class UpdateDriveFileDto {
  @IsOptional() @IsString() @Length(1, 255) name?: string;
  @IsOptional() @IsUUID() folderId?: string | null;
}

export class LinkDriveIssueDto { @IsUUID() postId: string; }
