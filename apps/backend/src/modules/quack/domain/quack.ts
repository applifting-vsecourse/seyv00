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

// How many replies the feed shows under a quack before "Show more replies".
export const REPLY_PREVIEW_COUNT = 3;

// What a reply answers, for the "↳ reply to @username" header.
export type ReplyParent = {
  id: string;
  isDeleted: boolean;
  // null when the parent was deleted
  username: string | null;
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
  // set on a reply; replies are one level deep
  parentId: string | null;
  parent: ReplyParent | null;
  replyCount: number;
  // oldest first: the first REPLY_PREVIEW_COUNT in the feed, all of them in a
  // thread, none on a reply
  replies: Quack[];
};

// What deleting did: the quack is gone, or it had replies and became a placeholder.
export type DeleteOutcome = 'deleted' | 'placeholder';

// What the vote upsert did, for the usage log.
export type VoteOutcome = 'first' | 'change' | 'same';

export class QuackNotFoundError extends Error {
  constructor() {
    super('Quack not found');
  }
}

export class ReplyToReplyError extends Error {
  constructor() {
    super('Replies are one level deep: reply to the quack the reply belongs to');
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
