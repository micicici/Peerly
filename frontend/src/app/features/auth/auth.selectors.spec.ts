import { selectNeedsOffering } from './auth.selectors';
import { AuthState } from './auth.reducer';

const meBase = {
  id: '1',
  email: 'a@b.c',
  name: 'A',
  bio: null as string | null,
  avatarUrl: null as string | null,
  gender: null as 'male' | 'female' | null,
  yearOfBirth: null as number | null,
  spokenLanguages: [] as string[],
  timezone: 'UTC',
  role: 'USER' as const,
};

describe('selectNeedsOffering', () => {
  it('is true when offeringCount is 0', () => {
    const auth: AuthState = {
      token: 't',
      me: { ...meBase, balance: 0, offeringCount: 0 },
      status: 'idle',
      errorCode: null,
      errorMessage: null,
    };
    expect(selectNeedsOffering({ auth })).toBe(true);
  });

  it('is false when offeringCount >= 1', () => {
    const auth: AuthState = {
      token: 't',
      me: { ...meBase, balance: 3, offeringCount: 1 },
      status: 'idle',
      errorCode: null,
      errorMessage: null,
    };
    expect(selectNeedsOffering({ auth })).toBe(false);
  });

  it('is false for an admin who has not published an offering', () => {
    const auth: AuthState = {
      token: 't',
      me: { ...meBase, role: 'ADMIN', balance: 0, offeringCount: 0 },
      status: 'idle',
      errorCode: null,
      errorMessage: null,
    };
    expect(selectNeedsOffering({ auth })).toBe(false);
  });
});
