import { Reflector } from '@nestjs/core';
import { AppError } from './app-error';
import { ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

function guardFor(roles: string[] | undefined, user: unknown) {
  const reflector = {
    getAllAndOverride: (key: string) => (key === ROLES_KEY ? roles : undefined),
  } as unknown as Reflector;
  const context = {
    getType: () => 'http',
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
  return new RolesGuard(reflector).canActivate(context as never);
}

describe('RolesGuard', () => {
  it('allows routes that do not declare a role', () => {
    expect(guardFor(undefined, undefined)).toBe(true);
  });

  it('allows an admin on an admin route', () => {
    expect(guardFor(['ADMIN'], { role: 'ADMIN' })).toBe(true);
  });

  it('rejects a regular user on an admin route', () => {
    expect(() => guardFor(['ADMIN'], { role: 'USER' })).toThrow(AppError);
    try {
      guardFor(['ADMIN'], { role: 'USER' });
    } catch (err) {
      expect(err).toMatchObject({
        code: 'FORBIDDEN',
        httpStatus: 403,
        message: 'Admin access required',
      });
    }
  });

  it('rejects a missing user on an admin route', () => {
    expect(() => guardFor(['ADMIN'], undefined)).toThrow(AppError);
  });
});
