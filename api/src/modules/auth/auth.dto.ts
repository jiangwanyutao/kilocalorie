import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @IsString()
  @Length(8, 64, { message: '密码 8-64 位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: '密码需含字母和数字' })
  password!: string;

  @IsString()
  @Length(2, 30, { message: '昵称 2-30 字' })
  nickname!: string;
}

export class LoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @Length(32, 128)
  refreshToken!: string;
}

export class ForgotDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;
}

export class ResetDto {
  @IsString()
  @Length(32, 128)
  token!: string;

  @IsString()
  @Length(8, 64, { message: '新密码 8-64 位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: '密码需含字母和数字' })
  newPassword!: string;
}
