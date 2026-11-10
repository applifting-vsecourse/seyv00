import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import {
  DeleteOutcome,
  Poll,
  Quack,
  QuackMood,
  REPLY_PREVIEW_COUNT,
  ReplyParent,
  VoteOutcome,
} from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

// Every read of a quack loads the same relations, so the feed and the search
// can never disagree about what a quack looks like.
const quackInclude = {
  user: true,
  pollOptions: { orderBy: { position: 'asc' } },
  // only what the "↳ reply to @username" header needs
  parent: {
    select: { id: true, deletedAt: true, user: { select: { username: true } } },
  },
  _count: { select: { replies: true } },
} satisfies Prisma.QuackInclude;

// A reply nested under its thread: its parent is that thread and it has no
// poll and no replies, so only the author is loaded.
const replyInclude = { user: true } satisfies Prisma.QuackInclude;

const replyOrder = [
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.QuackOrderByWithRelationInput[];

// A thread: the quack with all its replies, oldest first.
const threadInclude = {
  ...quackInclude,
  replies: { orderBy: replyOrder, include: replyInclude },
} satisfies Prisma.QuackInclude;

type PrismaQuackWithRelations = Prisma.QuackGetPayload<{
  include: typeof quackInclude;
}>;

type PrismaReply = Prisma.QuackGetPayload<{ include: typeof replyInclude }>;

type PrismaQuackWithReplies = PrismaQuackWithRelations & {
  replies?: PrismaReply[];
};

// A placeholder without replies has nothing left to show: it is never read,
// even when its last reply disappeared some way other than the service
// (e.g. a deleted account).
const shownQuack = {
  OR: [{ deletedAt: null }, { replies: { some: {} } }],
} satisfies Prisma.QuackWhereInput;

// Postgres refused a write because of a foreign key: a quack that has replies
// can't be hard-deleted, and a reply can't point at a quack that is gone.
const isForeignKeyViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2003';

type PollVotes = {
  // optionId -> number of votes
  counts: Map<string, number>;
  // quackId -> the viewer's optionId
  myVotes: Map<string, string>;
};

const mapPrismaPollToDomain = (
  quack: PrismaQuackWithRelations,
  viewerId: string,
  votes: PollVotes,
): Poll | null => {
  if (quack.pollOptions.length === 0) return null;
  const options = quack.pollOptions.map((option) => ({
    id: option.id,
    text: option.text,
    votes: votes.counts.get(option.id) ?? 0,
  }));
  return {
    options,
    totalVotes: options.reduce((total, option) => total + option.votes, 0),
    myOptionId: votes.myVotes.get(quack.id) ?? null,
    isAuthor: quack.userId === viewerId,
  };
};

const mapPrismaParentToDomain = (
  parent: PrismaQuackWithRelations['parent'],
): ReplyParent | null =>
  parent
    ? {
        id: parent.id,
        isDeleted: parent.deletedAt !== null,
        username: parent.user?.username ?? null,
      }
    : null;

const mapPrismaUserToDomain = (user: PrismaReply['user']): Quack['user'] =>
  // a placeholder has no author
  user
    ? { id: user.id, name: user.name, username: user.username ?? '' }
    : undefined;

// A reply shown under its thread: the thread is its parent, and a reply never
// has a poll or replies of its own.
const mapPrismaReplyToDomain = (
  reply: PrismaReply,
  thread: PrismaQuackWithRelations,
): Quack => ({
  id: reply.id,
  text: reply.text,
  mood: reply.mood,
  userId: reply.userId,
  createdAt: reply.createdAt,
  updatedAt: reply.updatedAt,
  user: mapPrismaUserToDomain(reply.user),
  poll: null,
  isDeleted: false,
  parentId: thread.id,
  parent: {
    id: thread.id,
    isDeleted: thread.deletedAt !== null,
    username: thread.user?.username ?? null,
  },
  replyCount: 0,
  replies: [],
});

const mapPrismaQuackToDomain = (
  quack: PrismaQuackWithReplies,
  viewerId: string,
  votes: PollVotes,
): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  user: mapPrismaUserToDomain(quack.user),
  poll: mapPrismaPollToDomain(quack, viewerId, votes),
  isDeleted: quack.deletedAt !== null,
  parentId: quack.parentId,
  parent: mapPrismaParentToDomain(quack.parent),
  replyCount: quack._count.replies,
  replies: (quack.replies ?? []).map((reply) =>
    mapPrismaReplyToDomain(reply, quack),
  ),
});

// Search words are user input: escape LIKE wildcards so "100%" or "a_b" match
// literally instead of acting as patterns.
const escapeLikePattern = (word: string): string =>
  word.replace(/[\\%_]/g, '\\$&');

/**
 * If you decide to choose a different ORM or database, you should only need to change the repository files methods implementation.
 * Inject what you need instead of PrismaService and re-implement the methods and model mapping.
 */
@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The feed: threads (top-level quacks and placeholders that still have
   * replies), newest first, each with its first few replies.
   * With `authorId`: that author's quacks *and* replies instead. A placeholder
   * has no author, so it never shows up there.
   */
  async getQuacks(viewerId: string, authorId?: string): Promise<Quack[]> {
    const quacks = await this.prisma.quack.findMany({
      where: authorId
        ? { userId: authorId }
        : { parentId: null, ...shownQuack },
      include: quackInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return this.mapWithVotes(await this.withReplyPreviews(quacks), viewerId);
  }

  /**
   * A thread with all its replies, or null when there's no such top-level
   * quack (a reply's id included) or only an empty placeholder is left.
   */
  async getThread(quackId: string, viewerId: string): Promise<Quack | null> {
    const quack = await this.prisma.quack.findFirst({
      where: { id: quackId, parentId: null, ...shownQuack },
      include: threadInclude,
    });
    if (!quack) return null;
    const [mapped] = await this.mapWithVotes([quack], viewerId);
    return mapped;
  }

  /**
   * What the service needs to accept a reply: null when there's nothing to
   * reply to; otherwise whether the target is itself a reply.
   */
  async getReplyTarget(
    quackId: string,
  ): Promise<{ parentId: string | null } | null> {
    return this.prisma.quack.findFirst({
      where: { id: quackId, ...shownQuack },
      select: { parentId: true },
    });
  }

  /**
   * Null when the parent disappeared after the service checked it (the
   * foreign key refused the reply).
   */
  async createReply(replyData: {
    parentId: string;
    text: string;
    mood: QuackMood | null;
    userId: string;
  }): Promise<Quack | null> {
    try {
      const reply = await this.prisma.quack.create({
        data: {
          text: replyData.text,
          mood: replyData.mood,
          user: { connect: { id: replyData.userId } },
          parent: { connect: { id: replyData.parentId } },
        },
        include: quackInclude,
      });
      // a reply has no poll, so there are no votes to load
      return mapPrismaQuackToDomain(reply, replyData.userId, {
        counts: new Map(),
        myVotes: new Map(),
      });
    } catch (error) {
      // `connect` reports a missing parent as P2025, the foreign key as P2003
      if (
        isForeignKeyViolation(error) ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025')
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Quacks where every word appears in the text, the author's name or their
   * username, ignoring case and accents. Newest first, like getQuacks.
   * Poll answers are deliberately not searched — a poll is found by its question.
   * Limited to `authorId`'s quacks when given.
   */
  async searchQuacks(
    words: string[],
    viewerId: string,
    authorId?: string,
  ): Promise<Quack[]> {
    // Prisma's query builder has no accent-insensitive match, so the filter is
    // raw SQL and the rows are then loaded the usual way.
    const conditions = words.map((word) => {
      const pattern = `%${escapeLikePattern(word)}%`;
      return Prisma.sql`(
        unaccent(q."text") ILIKE unaccent(${pattern})
        OR unaccent(u."name") ILIKE unaccent(${pattern})
        OR unaccent(coalesce(u."username", '')) ILIKE unaccent(${pattern})
      )`;
    });
    const matches = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT q."id" FROM "quack" q
      JOIN "user" u ON u."id" = q."userId"
      WHERE q."deletedAt" IS NULL
        AND ${Prisma.join(conditions, ' AND ')}
    `;

    // Replies are found too; each result carries its parent for the
    // "↳ reply to" header, and a top-level result its first replies.
    const quacks = await this.prisma.quack.findMany({
      where: {
        id: { in: matches.map((match) => match.id) },
        userId: authorId,
      },
      include: quackInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return this.mapWithVotes(await this.withReplyPreviews(quacks), viewerId);
  }

  async createQuack(createQuackData: {
    text: string;
    mood: QuackMood | null;
    pollOptions: string[] | null;
    userId: string;
  }): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: createQuackData.userId } },
        // one write: a poll never exists with only some of its answers
        pollOptions: createQuackData.pollOptions
          ? {
              create: createQuackData.pollOptions.map((text, position) => ({
                text,
                position,
              })),
            }
          : undefined,
      },
      include: quackInclude,
    });
    return mapPrismaQuackToDomain(quack, createQuackData.userId, {
      counts: new Map(),
      myVotes: new Map(),
    });
  }

  /**
   * Deletes the quack if `authorId` wrote it. The service checks who may
   * delete against that author first; repeating the author here means the
   * delete only hits the quack that check was about.
   *
   * - A reply is deleted for good. If it was the last reply under a
   *   placeholder, the placeholder goes too.
   * - A top-level quack without replies is deleted for good; its poll answers
   *   and votes go with it (onDelete: Cascade).
   * - A top-level quack with replies becomes a placeholder: text, mood, author
   *   and poll are erased, the row stays so its thread holds together.
   *
   * Null when nothing matched (gone in the meantime).
   */
  async deleteQuack(
    quackId: string,
    authorId: string,
    parentId: string | null,
  ): Promise<DeleteOutcome | null> {
    if (parentId !== null) {
      return this.deleteReply(quackId, parentId, authorId);
    }

    return this.prisma.$transaction(async (tx) => {
      // Lock the quack. Adding a reply (its foreign key needs a share lock)
      // and deleting a reply (see deleteReply) wait for this lock, so the
      // replies counted below are the ones there when we commit: a quack that
      // just lost its last reply is deleted, never left as an empty
      // placeholder, and a reply that just arrived is never lost.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "quack"
        WHERE "id" = ${quackId} AND "userId" = ${authorId}
        FOR UPDATE
      `;
      if (locked.length === 0) return null;

      const replyCount = await tx.quack.count({ where: { parentId: quackId } });
      if (replyCount === 0) {
        // poll answers and votes go with it (onDelete: Cascade)
        await tx.quack.delete({ where: { id: quackId } });
        return 'deleted';
      }

      // votes go with their answers (onDelete: Cascade)
      await tx.pollOption.deleteMany({ where: { quackId } });
      await tx.quack.update({
        where: { id: quackId },
        // all four together, or quack_placeholder_check refuses the row
        data: { text: null, mood: null, userId: null, deletedAt: new Date() },
      });
      return 'placeholder';
    });
  }

  private async deleteReply(
    replyId: string,
    parentId: string,
    authorId: string,
  ): Promise<DeleteOutcome | null> {
    return this.prisma.$transaction(async (tx) => {
      // Lock the parent first. Two people deleting the last two replies at
      // once then take turns, and the second one sees the first one's delete
      // and removes the empty placeholder. While the lock is held nobody can
      // add a reply (that needs a share lock on the parent) or turn the
      // parent into a placeholder (deleteQuack locks it too).
      await tx.$queryRaw`SELECT 1 FROM "quack" WHERE "id" = ${parentId} FOR UPDATE`;
      const { count } = await tx.quack.deleteMany({
        where: { id: replyId, userId: authorId },
      });
      if (count === 0) return null;
      await tx.quack.deleteMany({
        where: {
          id: parentId,
          deletedAt: { not: null },
          replies: { none: {} },
        },
      });
      return 'deleted';
    });
  }

  /**
   * Who wrote the quack and what it replies to, or null when there's nothing
   * to delete: no such quack, or a placeholder (which has no author and can't
   * be deleted directly).
   */
  async getDeleteTarget(
    quackId: string,
  ): Promise<{ authorId: string; parentId: string | null } | null> {
    const quack = await this.prisma.quack.findUnique({
      where: { id: quackId },
      select: { userId: true, parentId: true },
    });
    if (!quack?.userId) return null;
    return { authorId: quack.userId, parentId: quack.parentId };
  }

  /** The poll's answer ids, or null when there's no such quack or it isn't a poll. */
  async getPollOptionIds(quackId: string): Promise<string[] | null> {
    const options = await this.prisma.pollOption.findMany({
      where: { quackId },
      select: { id: true },
    });
    return options.length > 0 ? options.map((option) => option.id) : null;
  }

  async getPoll(quackId: string, viewerId: string): Promise<Poll | null> {
    const quack = await this.prisma.quack.findUnique({
      where: { id: quackId },
      include: quackInclude,
    });
    if (!quack) return null;
    const [mapped] = await this.mapWithVotes([quack], viewerId);
    return mapped.poll;
  }

  /**
   * Casts or moves the user's vote in one atomic statement. Prisma's `upsert`
   * only does that under certain conditions; otherwise it reads, then writes,
   * and two tabs casting a first vote at once would collide. The primary key
   * (quackId, userId) makes a second vote row impossible either way.
   */
  async castVote(vote: {
    quackId: string;
    userId: string;
    optionId: string;
  }): Promise<VoteOutcome> {
    // xmax = 0 means the row was inserted rather than updated; no row comes
    // back when the vote already pointed at this answer.
    const rows = await this.prisma.$queryRaw<{ inserted: boolean }[]>`
      INSERT INTO "poll_vote" ("quackId", "userId", "optionId")
      VALUES (${vote.quackId}, ${vote.userId}, ${vote.optionId})
      ON CONFLICT ("quackId", "userId") DO UPDATE
        SET "optionId" = EXCLUDED."optionId", "updatedAt" = now()
        WHERE "poll_vote"."optionId" IS DISTINCT FROM EXCLUDED."optionId"
      RETURNING (xmax = 0) AS inserted
    `;
    if (rows.length === 0) return 'same';
    return rows[0].inserted ? 'first' : 'change';
  }

  /**
   * The first few replies of each quack, for the feed and search results.
   * A nested `take` would make Prisma load every reply and cut them down in
   * memory, so the limit per thread is applied in SQL instead.
   */
  private async withReplyPreviews(
    quacks: PrismaQuackWithRelations[],
  ): Promise<PrismaQuackWithReplies[]> {
    const threadIds = quacks
      .filter((quack) => quack._count.replies > 0)
      .map((quack) => quack.id);
    if (threadIds.length === 0) return quacks;

    const previews = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM (
        SELECT "id", row_number() OVER (
          PARTITION BY "parentId" ORDER BY "createdAt", "id"
        ) AS "position"
        FROM "quack"
        WHERE "parentId" IN (${Prisma.join(threadIds)})
      ) AS "reply"
      WHERE "position" <= ${REPLY_PREVIEW_COUNT}
    `;
    const replies = await this.prisma.quack.findMany({
      where: { id: { in: previews.map((preview) => preview.id) } },
      include: replyInclude,
      orderBy: replyOrder,
    });

    const repliesByThread = new Map<string, PrismaReply[]>();
    for (const reply of replies) {
      if (reply.parentId === null) continue;
      const threadReplies = repliesByThread.get(reply.parentId) ?? [];
      threadReplies.push(reply);
      repliesByThread.set(reply.parentId, threadReplies);
    }
    return quacks.map((quack) => ({
      ...quack,
      replies: repliesByThread.get(quack.id) ?? [],
    }));
  }

  // Two queries however many polls the feed holds — and none without polls.
  // Replies never carry a poll, so only the quacks themselves are looked at.
  private async mapWithVotes(
    quacks: PrismaQuackWithReplies[],
    viewerId: string,
  ): Promise<Quack[]> {
    const pollIds = quacks
      .filter((quack) => quack.pollOptions.length > 0)
      .map((quack) => quack.id);

    const votes: PollVotes = { counts: new Map(), myVotes: new Map() };
    if (pollIds.length > 0) {
      const [counts, myVotes] = await Promise.all([
        this.prisma.pollVote.groupBy({
          by: ['optionId'],
          where: { quackId: { in: pollIds } },
          _count: { _all: true },
        }),
        this.prisma.pollVote.findMany({
          where: { userId: viewerId, quackId: { in: pollIds } },
          select: { quackId: true, optionId: true },
        }),
      ]);
      for (const count of counts) {
        votes.counts.set(count.optionId, count._count._all);
      }
      for (const vote of myVotes) {
        votes.myVotes.set(vote.quackId, vote.optionId);
      }
    }

    return quacks.map((quack) =>
      mapPrismaQuackToDomain(quack, viewerId, votes),
    );
  }
}
