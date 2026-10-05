import { canonicalSubjectName } from './subject-name';

describe('canonicalSubjectName', () => {
  it('trims and collapses whitespace', () => {
    expect(canonicalSubjectName('  Music   theory ')).toEqual({
      name: 'Music theory',
      nameKey: 'music theory',
    });
  });

  it('rejects blank and oversized names', () => {
    expect(canonicalSubjectName('   ')).toBeNull();
    expect(canonicalSubjectName('a'.repeat(61))).toBeNull();
  });
});
