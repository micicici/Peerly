export type SubjectPastel = {
  background: string;
  border: string;
  accent: string;
};

export function subjectColorKey(subjectName: string | null | undefined): string {
  return (subjectName ?? '').trim().toLowerCase() || 'subject';
}

export function pastelForSubject(subjectName: string | null | undefined): SubjectPastel {
  return pastelFromHue(hashString(subjectColorKey(subjectName)) % 360);
}

/** Gives every subject on the current card grid its own evenly spaced hue. */
export function pastelsForSubjects(
  names: Iterable<string | null | undefined>,
): Map<string, SubjectPastel> {
  const ranked = [...new Set([...names].map(subjectColorKey))]
    .map((key) => ({ key, preferred: hashString(key) % 360 }))
    .sort((a, b) => a.preferred - b.preferred || a.key.localeCompare(b.key));
  const map = new Map<string, SubjectPastel>();
  const step = ranked.length === 0 ? 0 : 360 / ranked.length;
  const anchor = ranked[0]?.preferred ?? 0;
  ranked.forEach((item, index) => {
    map.set(item.key, pastelFromHue((anchor + index * step) % 360));
  });
  return map;
}

function pastelFromHue(hue: number): SubjectPastel {
  const h = ((hue % 360) + 360) % 360;
  return {
    background: `hsl(${h} 62% 88%)`,
    border: `hsl(${h} 48% 72%)`,
    accent: `hsl(${h} 55% 46%)`,
  };
}

function hashString(key: string): number {
  let hash = 0;
  for (const char of key) {
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

