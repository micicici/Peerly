export type AvatarGender = 'male' | 'female' | null | undefined;

export function displayAvatar(
  customUrl: string | null | undefined,
  gender: AvatarGender,
): string {
  if (customUrl) {
    return customUrl;
  }
  if (gender === 'female') {
    return '/avatars/female.svg';
  }
  if (gender === 'male') {
    return '/avatars/male.svg';
  }
  return '/avatars/neutral.svg';
}
