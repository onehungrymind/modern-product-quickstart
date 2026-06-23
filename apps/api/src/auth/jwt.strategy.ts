import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { User } from '@tracer/common-models';
import { UsersService, toUserDto } from '../users/users.service';

export interface JwtPayload {
  sub: string; // user id
}

function cookieExtractor(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.['tracer_token'] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env['JWT_SECRET'] ?? 'dev-not-secret-change-me',
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const entity = await this.users.findById(payload.sub);
    if (!entity) {
      throw new Error('User not found');
    }
    return toUserDto(entity);
  }
}
