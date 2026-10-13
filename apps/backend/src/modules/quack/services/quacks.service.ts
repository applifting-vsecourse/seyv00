import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Splits a search box value into the words a quack must all contain.
 * A leading @ is dropped so "@CaffeinatedDuck" matches the username.
 */
export const parseSearchTerm = (term: string | undefined): string[] =>
  (term ?? '')
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^@+/, ''))
    .filter((word) => word.length > 0);

@Injectable()
export class QuacksService {
  private readonly logger = new Logger(QuacksService.name);

  constructor(private readonly quackRepository: QuackRepository) {}

  async getQuacks(): Promise<Quack[]> {
    return this.quackRepository.getQuacks();
  }

  async searchQuacks(
    user: Identity,
    term: string | undefined,
  ): Promise<Quack[]> {
    const words = parseSearchTerm(term);
    if (words.length === 0) {
      return this.quackRepository.getQuacks();
    }

    const quacks = await this.quackRepository.searchQuacks(words);
    // One line per search so we can see whether people use it. The search
    // text itself is deliberately left out — it's personal.
    this.logger.log(
      `quack search userId=${user.id} words=${words.length} results=${quacks.length}`,
    );
    return quacks;
  }

  async createQuack(
    user: Identity,
    quackData: { text: string; mood: QuackMood | null },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      mood: quackData.mood,
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }
}
