import {
  ExecutionContext,
  Injectable,
  createParamDecorator,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest } from 'fastify';
import type { AuthUser } from './jwt.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest & { user: AuthUser }>();
    return req.user;
  },
);
