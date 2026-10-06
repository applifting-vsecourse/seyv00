import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Prisma,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

const mapPrismaQuackToDomain = (
  quack: PrismaQuack & { user?: PrismaUser },
): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  user: quack.user
    ? {
        id: quack.user.id,
        name: quack.user.name,
        username: quack.user.username ?? '',
      }
    : undefined,
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

  async getQuacks(): Promise<Quack[]> {
    const quacks = await this.prisma.quack.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    return quacks.map(mapPrismaQuackToDomain);
  }

  /**
   * Quacks where every word appears in the text, the author's name or their
   * username, ignoring case and accents. Newest first, like getQuacks.
   */
  async searchQuacks(words: string[]): Promise<Quack[]> {
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
      where: { id: { in: matches.map((match) => match.id) } },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    return quacks.map(mapPrismaQuackToDomain);
  }

  async createQuack(createQuackData: {
    text: string;
    mood: QuackMood | null;
    userId: string;
  }): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: createQuackData.userId } },
      },
      include: { user: true },
    });
    return mapPrismaQuackToDomain(quack);
  }
}
