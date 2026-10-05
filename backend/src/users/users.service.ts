import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AppError } from '../common/app-error';
import { normalizeSpokenLanguages } from './spoken-languages';
import { roleForEmail } from './user-role';
import { Gender, User } from './user.entity';

export type CreateUserInput = {
  email: string;
  password: string;
  name: string;
  timezone: string;
  bio: string;
  gender: Gender;
  yearOfBirth: number;
  spokenLanguages: string[];
};

export type UpdateProfileInput = {
  name?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  timezone?: string;
  gender?: Gender;
  yearOfBirth?: number;
  spokenLanguages?: string[];
};

/** Account persistence: password hashing, profile updates, and admin assignment. */
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
      bio: input.bio,
      avatarUrl: null,
      gender: input.gender,
      yearOfBirth: this.assertYear(input.yearOfBirth),
      spokenLanguages: normalizeSpokenLanguages(input.spokenLanguages),
      role: roleForEmail(input.email),
    });
    return this.users.save(user);
  }

  async applyAdminAllowlist(user: User): Promise<User> {
    if (user.role === 'ADMIN' || roleForEmail(user.email) !== 'ADMIN') {
      return user;
    }
    await this.users.update(user.id, { role: 'ADMIN' });
    user.role = 'ADMIN';
    return user;
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
    if (patch.gender !== undefined) changes.gender = patch.gender;
    if (patch.yearOfBirth !== undefined) {
      changes.yearOfBirth = this.assertYear(patch.yearOfBirth);
    }
    if (patch.spokenLanguages !== undefined) {
      changes.spokenLanguages = normalizeSpokenLanguages(patch.spokenLanguages);
    }
    if (Object.keys(changes).length > 0) {
      await this.users.update(id, changes);
    }
    const user = await this.findById(id);
    if (!user) {
      throw new AppError('UNAUTHENTICATED', 'Invalid credentials', 401);
    }
    return user;
  }

  async distinctLanguages(): Promise<string[]> {
    const rows: { language: string }[] = await this.users.query(
      `SELECT DISTINCT lang AS language
       FROM users
       CROSS JOIN LATERAL unnest(users."spokenLanguages") AS lang
       WHERE btrim(lang) <> ''
       ORDER BY language ASC`,
    );
    return rows.map((row) => row.language);
  }

  private assertYear(year: number): number {
    const current = new Date().getFullYear();
    if (!Number.isInteger(year) || year < 1900 || year > current) {
      throw new AppError('FORBIDDEN', 'Enter a valid year of birth', 400);
    }
    return year;
  }
}
