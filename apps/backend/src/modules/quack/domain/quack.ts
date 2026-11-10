export const QUACK_MOODS = ['happy', 'sad', 'angry', 'silly'] as const;

export type QuackMood = (typeof QUACK_MOODS)[number];

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 4;
export const POLL_OPTION_MAX_LENGTH = 50;

export type QuackAuthor = {
  id: string;
  name: string;
  username: string;
};

export type PollOption = {
  id: string;
  text: string;
  votes: number;
};

// Seen through the eyes of one viewer: their own vote and whether they wrote it.
export type Poll = {
  options: PollOption[];
  totalVotes: number;
  myOptionId: string | null;
  isAuthor: boolean;
};

// A deleted quack that still has replies stays as a placeholder so its thread
// holds together: isDeleted is true and text, mood, author and poll are gone.
export type Quack = {
  id: string;
  text: string | null;
  mood: QuackMood | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: QuackAuthor;
  poll: Poll | null;
  isDeleted: boolean;
};

// What the vote upsert did, for the usage log.
export type VoteOutcome = 'first' | 'change' | 'same';

export class QuackNotFoundError extends Error {
  constructor() {
    super('Quack not found');
  }
}

export class PollNotFoundError extends Error {
  constructor() {
    super('Poll not found');
  }
}

export class PollOptionNotFoundError extends Error {
  constructor() {
    super('That answer is not part of this poll');
  }
}
