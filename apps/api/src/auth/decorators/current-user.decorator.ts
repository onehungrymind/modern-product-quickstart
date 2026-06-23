import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '@tracer/common-models';

/** Injects the authenticated user (set on req.user by JwtStrategy.validate). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const req = ctx.switchToHttp().getRequest<{ user: User }>();
    return req.user;
  },
);
