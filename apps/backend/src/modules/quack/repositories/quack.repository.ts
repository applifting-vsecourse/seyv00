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

// A thread: the quack with all its replies, oldest first.
const threadInclude = {
  ...quackInclude,
  replies: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: quackInclude,
  },
} satisfies Prisma.QuackInclude;

// The feed: like a thread, but only the first few replies.
const feedInclude = {
  ...quackInclude,
  replies: { ...threadInclude.replies, take: REPLY_PREVIEW_COUNT },
} satisfies Prisma.QuackInclude;

type PrismaQuackWithRelations = Prisma.QuackGetPayload<{
  include: typeof quackInclude;
}>;

type PrismaQuackWithReplies = PrismaQuackWithRelations & {
  replies?: PrismaQuackWithRelations[];
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
  // a placeholder has no author
  user: quack.user
    ? {
        id: quack.user.id,
        name: quack.user.name,
        username: quack.user.username ?? '',
      }
    : undefined,
  poll: mapPrismaPollToDomain(quack, viewerId, votes),
  isDeleted: quack.deletedAt !== null,
  parentId: quack.parentId,
  parent: mapPrismaParentToDomain(quack.parent),
  replyCount: quack._count.replies,
  replies: (quack.replies ?? []).map((reply) =>
    mapPrismaQuackToDomain(reply, viewerId, votes),
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
      where: authorId ? { userId: authorId } : { parentId: null, ...shownQuack },
      include: feedInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return this.mapWithVotes(quacks, viewerId);
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
      include: feedInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return this.mapWithVotes(quacks, viewerId);
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
  ): Promise<DeleteOutcome | null> {
    const quack = await this.prisma.quack.findFirst({
      where: { id: quackId, userId: authorId },
      select: { parentId: true },
    });
    if (!quack) return null;
    if (quack.parentId !== null) {
      return this.deleteReply(quackId, quack.parentId, authorId);
    }

    try {
      const { count } = await this.prisma.quack.deleteMany({
        where: { id: quackId, userId: authorId, replies: { none: {} } },
      });
      if (count > 0) return 'deleted';
    } catch (error) {
      // A reply arrived between the check above and the delete: the database
      // refused the delete (ON DELETE NO ACTION), so fall through to the
      // placeholder. The reply is never lost.
      if (!isForeignKeyViolation(error)) throw error;
    }

    const [, { count }] = await this.prisma.$transaction([
      // votes go with their answers (onDelete: Cascade)
      this.prisma.pollOption.deleteMany({ where: { quackId } }),
      this.prisma.quack.updateMany({
        where: { id: quackId, userId: authorId },
        // all four together, or quack_placeholder_check refuses the row
        data: { text: null, mood: null, userId: null, deletedAt: new Date() },
      }),
    ]);
    return count > 0 ? 'placeholder' : null;
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
      // add a reply either (that needs a share lock on the parent).
      await tx.$queryRaw`SELECT 1 FROM "quack" WHERE "id" = ${parentId} FOR UPDATE`;
      const { count } = await tx.quack.deleteMany({
        where: { id: replyId, userId: authorId },
      });
      if (count === 0) return null;
      await tx.quack.deleteMany({
        where: { id: parentId, deletedAt: { not: null }, replies: { none: {} } },
      });
      return 'deleted';
    });
  }

  /**
   * Who wrote the quack, or null when there's nothing to delete: no such
   * quack, or a placeholder (which has no author and can't be deleted directly).
   */
  async getQuackAuthorId(quackId: string): Promise<string | null> {
    const quack = await this.prisma.quack.findUnique({
      where: { id: quackId },
      select: { userId: true },
    });
    return quack?.userId ?? null;
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
