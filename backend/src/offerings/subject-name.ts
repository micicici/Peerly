export function canonicalSubjectName(
  raw: string,
): { name: string; nameKey: string } | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 60) {
    return null;
  }
  return { name, nameKey: name.toLowerCase() };
}
