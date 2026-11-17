import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class GlobalSearchDto {
  @IsString()
  @Length(2, 100)
  query: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 8;
}

export class DashboardQueryDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
