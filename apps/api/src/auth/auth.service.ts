import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@tracer/common-models';
import { UsersService, toUserDto } from '../users/users.service';
import type { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    name: string;
  }): Promise<User> {
    const entity = await this.users.create(input);
    return toUserDto(entity);
  }

  async validate(email: string, password: string): Promise<User> {
    const entity = await this.users.findByEmail(email);
    if (!entity || !(await this.users.verifyPassword(entity, password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return toUserDto(entity);
  }

  signToken(user: User): string {
    const payload: JwtPayload = { sub: user.id };
    return this.jwt.sign(payload);
  }
}
