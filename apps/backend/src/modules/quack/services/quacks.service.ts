import {
  Poll,
  PollNotFoundError,
  PollOptionNotFoundError,
  Quack,
  QuackMood,
  QuackNotFoundError,
} from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

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

  async getQuacks(user: Identity): Promise<Quack[]> {
    return this.quackRepository.getQuacks(user.id);
  }

  async searchQuacks(
    user: Identity,
    term: string | undefined,
    onlyMine = false,
  ): Promise<Quack[]> {
    // "mine" always means the signed-in user, never an id from the request
    const authorId = onlyMine ? user.id : undefined;
    const words = parseSearchTerm(term);
    if (words.length === 0) {
      return this.quackRepository.getQuacks(user.id, authorId);
    }

    const quacks = await this.quackRepository.searchQuacks(
      words,
      user.id,
      authorId,
    );
    // One line per search so we can see whether people use it. The search
    // text itself is deliberately left out — it's personal.
    this.logger.log(
      `quack search userId=${user.id} words=${words.length} results=${quacks.length}`,
    );
    return quacks;
  }

  async createQuack(
    user: Identity,
    quackData: {
      text: string;
      mood: QuackMood | null;
      pollOptions: string[] | null;
    },
  ): Promise<Quack> {
    const quack = await this.quackRepository.createQuack({
      text: quackData.text,
      mood: quackData.mood,
      pollOptions: quackData.pollOptions,
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
    if (quackData.pollOptions) {
      // Usage only: neither the question nor the answers are logged.
      this.logger.log(
        `poll created userId=${user.id} options=${quackData.pollOptions.length}`,
      );
    }
    return quack;
  }

  async deleteQuack(user: Identity, quackId: string): Promise<void> {
    const authorId = await this.quackRepository.getQuackAuthorId(quackId);
    if (authorId === null) throw new QuackNotFoundError();
    // only the author may delete; the user comes from the session
    if (authorId !== user.id) {
      throw new ForbiddenException('Only the author can delete this quack');
    }
    const isDeleted = await this.quackRepository.deleteOwnQuack(
      quackId,
      user.id,
    );
    // gone in the meantime, e.g. deleted from another tab
    if (!isDeleted) throw new QuackNotFoundError();
  }

  async vote(user: Identity, quackId: string, optionId: string): Promise<Poll> {
    const optionIds = await this.quackRepository.getPollOptionIds(quackId);
    if (!optionIds) throw new PollNotFoundError();
    if (!optionIds.includes(optionId)) throw new PollOptionNotFoundError();

    const outcome = await this.quackRepository.castVote({
      quackId,
      // the voter is taken from the session, never from the request body
      userId: user.id,
      optionId,
    });
    this.logger.log(
      `poll vote userId=${user.id} quackId=${quackId} kind=${outcome}`,
    );

    // Fresh counts, including everyone else's votes since the feed loaded.
    const poll = await this.quackRepository.getPoll(quackId, user.id);
    if (!poll) throw new PollNotFoundError();
    return poll;
  }
}
