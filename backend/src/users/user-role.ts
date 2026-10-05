import { UserRole } from './user.entity';

export function roleForEmail(email: string): UserRole {
  const allow = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
  return allow.includes(email.trim().toLowerCase()) ? 'ADMIN' : 'USER';
}
