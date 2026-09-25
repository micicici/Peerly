import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AppError } from '../common/app-error';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ token: string }> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new AppError('EMAIL_TAKEN', 'Email already registered', 409);
    }
    const user = await this.users.create({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      timezone: dto.timezone,
    });
    return { token: this.sign(user) };
  }

  async login(dto: LoginDto): Promise<{ token: string }> {
    const user = await this.users.findByEmail(dto.email);
    const passwordOk =
      user !== null && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !passwordOk) {
      throw new AppError('UNAUTHENTICATED', 'Invalid credentials', 401);
    }
    return { token: this.sign(user) };
  }

  private sign(user: User): string {
    return this.jwt.sign({ sub: user.id, email: user.email });
  }
}
