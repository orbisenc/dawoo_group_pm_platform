import { CalendarEventKind } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from "class-validator";

export class CalendarFilterDto {
  @IsDateString() from: string;
  @IsDateString() to: string;
  @IsOptional() @Transform(({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value) @IsString() @MaxLength(100) query?: string;
  @IsOptional() @IsEnum(CalendarEventKind) kind?: CalendarEventKind;
}

export class CreateCalendarEventDto {
  @IsEnum(CalendarEventKind) kind: CalendarEventKind;
  @IsString() @Length(2, 200) title: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsDateString() startsAt: string;
  @IsDateString() endsAt: string;
  @IsOptional() @IsBoolean() allDay = false;
  @IsOptional() @IsString() @Length(1, 100) milestoneName?: string;
  @IsOptional() @IsUUID() groupId?: string;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsUUID() issueId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID("4", { each: true }) participantIds?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(525600) reminderMinutes = 1440;
}

export class UpdateCalendarEventDto {
  @IsOptional() @IsEnum(CalendarEventKind) kind?: CalendarEventKind;
  @IsOptional() @IsString() @Length(2, 200) title?: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsBoolean() allDay?: boolean;
  @IsOptional() @IsString() @Length(1, 100) milestoneName?: string;
  @IsOptional() @IsUUID() groupId?: string | null;
  @IsOptional() @IsUUID() assigneeId?: string | null;
  @IsOptional() @IsUUID() issueId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID("4", { each: true }) participantIds?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(525600) reminderMinutes?: number;
}

export class PrepareCalendarAttachmentDto {
  @IsString() @Length(1, 255) originalName: string;
  @IsString() @MaxLength(150) mimeType: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(52428800) size: number;
}
