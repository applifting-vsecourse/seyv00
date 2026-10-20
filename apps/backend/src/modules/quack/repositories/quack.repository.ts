import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import {
  Poll,
  Quack,
  QuackMood,
  VoteOutcome,
} from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

// Every read of a quack loads the same relations, so the feed and the search
// can never disagree about what a quack looks like.
const quackInclude = {
  user: true,
  pollOptions: { orderBy: { position: 'asc' } },
} satisfies Prisma.QuackInclude;

type PrismaQuackWithRelations = Prisma.QuackGetPayload<{
  include: typeof quackInclude;
}>;

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

const mapPrismaQuackToDomain = (
  quack: PrismaQuackWithRelations,
  viewerId: string,
  votes: PollVotes,
): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  user: {
    id: quack.user.id,
    name: quack.user.name,
    username: quack.user.username ?? '',
  },
  poll: mapPrismaPollToDomain(quack, viewerId, votes),
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

  /** The whole feed, or only `authorId`'s quacks when given. */
  async getQuacks(viewerId: string, authorId?: string): Promise<Quack[]> {
    const quacks = await this.prisma.quack.findMany({
      where: { userId: authorId },
      include: quackInclude,
      orderBy: { createdAt: 'desc' },
    });
    return this.mapWithVotes(quacks, viewerId);
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
      WHERE ${Prisma.join(conditions, ' AND ')}
    `;

    const quacks = await this.prisma.quack.findMany({
      where: {
        id: { in: matches.map((match) => match.id) },
        userId: authorId,
      },
      include: quackInclude,
      orderBy: { createdAt: 'desc' },
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
   * Deletes the quack if `userId` wrote it. The service checks the author
   * first; repeating it here means a race can't delete someone else's quack.
   * False when nothing matched. Poll answers and votes go with it (onDelete: Cascade).
   */
  async deleteOwnQuack(quackId: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.quack.deleteMany({
      where: { id: quackId, userId },
    });
    return count > 0;
  }

  /** Who wrote the quack, or null when there's no such quack. */
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
  private async mapWithVotes(
    quacks: PrismaQuackWithRelations[],
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
