import type { QuackMood } from '@/modules/quack/domain/quack';

// Same rules as better-auth's username plugin, so a name that was accepted at
// sign-up is always accepted here and vice versa.
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;

export const BIO_MAX_LENGTH = 160;

export type Profile = {
  username: string;
  name: string;
  bio: string | null;
  defaultMood: QuackMood | null;
};
