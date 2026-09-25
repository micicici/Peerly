import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AppError } from '../common/app-error';
import { User } from './user.entity';

export type CreateUserInput = {
  email: string;
  password: string;
  name: string;
  timezone: string;
};

export type UpdateProfileInput = {
  name?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  timezone?: string;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = this.users.create({
      email: input.email,
      passwordHash,
      name: input.name,
      timezone: input.timezone,
      bio: null,
      avatarUrl: null,
    });
    return this.users.save(user);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  async updateProfile(id: string, patch: UpdateProfileInput): Promise<User> {
    const changes: Partial<User> = {};
    if (patch.name !== undefined) changes.name = patch.name;
    if (patch.bio !== undefined) changes.bio = patch.bio;
    if (patch.avatarUrl !== undefined) changes.avatarUrl = patch.avatarUrl;
    if (patch.timezone !== undefined) changes.timezone = patch.timezone;
    if (Object.keys(changes).length > 0) {
      await this.users.update(id, changes);
    }
    const user = await this.findById(id);
    if (!user) {
      throw new AppError('UNAUTHENTICATED', 'Invalid credentials', 401);
    }
    return user;
  }
}
