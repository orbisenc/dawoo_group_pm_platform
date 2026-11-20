import { IsEmail, IsEnum, IsString, Length, Matches, MaxLength } from "class-validator";
import { PlatformRole } from "@prisma/client";

export class RegisterDto {
  @IsString()
  @Length(2, 100)
  name: string;

  @IsString()
  @Length(4, 50)
  @Matches(/^[a-zA-Z0-9._-]+$/, { message: "아이디는 영문, 숫자, 마침표, 밑줄, 하이픈만 사용할 수 있습니다." })
  username: string;

  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @Length(6, 128)
  password: string;
}

export class LoginDto {
  @IsString()
  @Length(4, 50)
  username: string;

  @IsString()
  @Length(6, 128)
  password: string;
}

export class UpdateAccountRoleDto {
  @IsEnum(PlatformRole)
  platformRole: PlatformRole;
}
