import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import type { User } from '@tracer/common-models';
import { UserEntity } from './entities/user.entity';

const BCRYPT_ROUNDS = 10;

export function toUserDto(e: UserEntity): User {
  return {
    id: e.id,
    email: e.email,
    name: e.name,
    created_at: e.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async create(input: {
    email: string;
    password: string;
    name: string;
  }): Promise<UserEntity> {
    const existing = await this.repo.findOne({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }
    const entity = this.repo.create({
      email: input.email,
      name: input.name,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    });
    return this.repo.save(entity);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    // Need to select passwordHash explicitly since it's select:false
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  verifyPassword(entity: UserEntity, password: string): Promise<boolean> {
    if (!entity.passwordHash) return Promise.resolve(false);
    return bcrypt.compare(password, entity.passwordHash);
  }
}
