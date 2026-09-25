import { selectNeedsOffering } from './auth.selectors';
import { AuthState } from './auth.reducer';

const meBase = {
  id: '1',
  email: 'a@b.c',
  name: 'A',
  bio: null as string | null,
  avatarUrl: null as string | null,
  timezone: 'UTC',
};

describe('selectNeedsOffering', () => {
  it('is true when offeringCount is 0', () => {
    const auth: AuthState = {
      token: 't',
      me: { ...meBase, balance: 0, offeringCount: 0 },
      status: 'idle',
      errorCode: null,
    };
    expect(selectNeedsOffering({ auth })).toBe(true);
  });

  it('is false when offeringCount >= 1', () => {
    const auth: AuthState = {
      token: 't',
      me: { ...meBase, balance: 3, offeringCount: 1 },
      status: 'idle',
      errorCode: null,
    };
    expect(selectNeedsOffering({ auth })).toBe(false);
  });
});
