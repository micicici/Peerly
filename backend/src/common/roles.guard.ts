import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '../users/user.entity';
import { AppError } from './app-error';
import { ROLES_KEY } from './roles.decorator';

/** Enforces `@Roles()` metadata. Handlers without it are not restricted. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }
    const roles = this.reflector.getAllAndOverride<User['role'][]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) {
      return true;
    }
    const user = context.switchToHttp().getRequest<{ user?: User }>().user;
    if (!user || !roles.includes(user.role)) {
      throw new AppError('FORBIDDEN', 'Admin access required', 403);
    }
    return true;
  }
}
