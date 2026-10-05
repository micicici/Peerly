import { pastelsForSubjects } from './subject-pastel';

describe('pastelsForSubjects', () => {
  it('gives IT and Math different colors', () => {
    const colors = pastelsForSubjects(['IT', 'Math']);
    expect(colors.get('it')?.background).not.toBe(colors.get('math')?.background);
    expect(colors.get('it')?.accent).not.toBe(colors.get('math')?.accent);
  });

  it('keeps one color per subject and assigns a new subject its own hue', () => {
    const before = pastelsForSubjects(['IT', 'Math', 'Cooking']);
    const after = pastelsForSubjects(['IT', 'Math', 'Cooking', 'Pottery']);
    const hues = [...after.values()].map((color) => color.background);
    expect(new Set(hues).size).toBe(4);
    expect(after.get('pottery')?.background).toBeTruthy();
    expect(after.get('pottery')?.background).not.toBe(before.get('it')?.background);
  });
});
