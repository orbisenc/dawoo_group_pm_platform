import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from "class-validator";

export class ApprovalListDto {
  @IsOptional() @IsIn(["all", "pending", "mine"]) scope: "all" | "pending" | "mine" = "all";
}

export class CreateApprovalDto {
  @IsString() @Length(1, 200) title: string;
  @IsString() @Length(1, 10000) content: string;
  @IsUUID() fileId: string;
  @IsUUID() fileVersionId: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ArrayUnique() @IsUUID("4", { each: true }) approverIds: string[];
}

export class UpdateApprovalDto {
  @IsOptional() @IsString() @Length(1, 200) title?: string;
  @IsOptional() @IsString() @Length(1, 10000) content?: string;
  @IsOptional() @IsUUID() fileId?: string;
  @IsOptional() @IsUUID() fileVersionId?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ArrayUnique() @IsUUID("4", { each: true }) approverIds?: string[];
}

export class ApprovalDecisionDto {
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

export class RejectApprovalDto {
  @IsString() @Length(1, 1000) comment: string;
}
