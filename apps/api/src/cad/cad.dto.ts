import { IsInt, IsString, Matches, Max, MaxLength, Min } from "class-validator";

export class PrepareCadUploadDto {
  @IsString()
  @MaxLength(255)
  @Matches(/\.(dwg|dxf)$/i, { message: "DWG 또는 DXF 파일만 열 수 있습니다." })
  fileName!: string;

  @IsInt()
  @Min(1)
  @Max(125 * 1024 * 1024)
  size!: number;

  @IsString()
  @MaxLength(150)
  contentType!: string;

  @IsString()
  @MaxLength(300)
  sourceId!: string;

  @IsString()
  @MaxLength(100)
  modifiedTime!: string;
}

export class CompleteCadUploadDto {
  @IsString()
  ticket!: string;
}

export class CadTicketQueryDto {
  @IsString()
  ticket!: string;
}
