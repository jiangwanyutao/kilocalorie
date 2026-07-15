import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { CurrentUser, JwtAuthGuard } from './auth.helpers';
import type { AuthUser } from './jwt.strategy';
import {
  ChangePasswordDto,
  ForgotDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetDto,
} from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly svc: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: FastifyRequest) {
    return this.svc.register(dto, req);
  }

  @Get('verify')
  verify(@Query('token') token: string) {
    return this.svc.verify(token);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: FastifyRequest) {
    return this.svc.login(dto, req);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.svc.refresh(dto);
  }

  @Post('forgot')
  @HttpCode(200)
  forgot(@Body() dto: ForgotDto) {
    return this.svc.forgot(dto);
  }

  @Post('reset')
  @HttpCode(200)
  reset(@Body() dto: ResetDto) {
    return this.svc.reset(dto);
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() u: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.svc.changePassword(u.id, dto);
  }
}
