import { roleForEmail } from './user-role';

describe('roleForEmail', () => {
  const previous = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = previous;
    }
  });

  it('defaults to USER', () => {
    delete process.env.ADMIN_EMAILS;
    expect(roleForEmail('ada@example.com')).toBe('USER');
  });

  it('grants ADMIN when the email is on the allow list', () => {
    process.env.ADMIN_EMAILS = ' Admin@Example.com , other@example.com ';
    expect(roleForEmail('admin@example.com')).toBe('ADMIN');
    expect(roleForEmail('student@example.com')).toBe('USER');
  });
});
