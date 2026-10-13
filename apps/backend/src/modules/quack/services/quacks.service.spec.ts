// Example unit test — the pattern to copy for your own services.
// The repository is mocked, so the test exercises the service in isolation.
import {
  Poll,
  PollNotFoundError,
  PollOptionNotFoundError,
  Quack,
} from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Logger } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { parseSearchTerm, QuacksService } from './quacks.service';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'quack quack',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  poll: null,
  ...overrides,
});

const aPoll = (overrides: Partial<Poll> = {}): Poll => ({
  options: [
    { id: 'o1', text: 'Pizza', votes: 2 },
    { id: 'o2', text: 'Thai', votes: 1 },
  ],
  totalVotes: 3,
  myOptionId: 'o2',
  isAuthor: false,
  ...overrides,
});

describe('QuacksService', () => {
  it('returns quacks from the repository', async () => {
    const quacks = [aQuack()];
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue(quacks);

    const service = new QuacksService(repository);

    await expect(service.getQuacks({ id: 'u1' } as Identity)).resolves.toEqual(
      quacks,
    );
    // the viewer decides which poll vote is "mine"
    expect(repository.getQuacks).toHaveBeenCalledWith('u1');
  });

  it('creates a quack owned by the signed-in user', async () => {
    const created = aQuack({ id: 'q2', text: 'hello' });
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(created);

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await expect(
      service.createQuack(user, {
        text: 'hello',
        mood: null,
        pollOptions: null,
      }),
    ).resolves.toEqual(created);
    // the author comes from the session, not from the caller's payload
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'hello',
      mood: null,
      pollOptions: null,
      userId: 'u1',
    });
  });

  it('passes the mood through to the repository', async () => {
    const created = aQuack({ id: 'q3', text: 'lol', mood: 'silly' });
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(created);

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await expect(
      service.createQuack(user, {
        text: 'lol',
        mood: 'silly',
        pollOptions: null,
      }),
    ).resolves.toEqual(created);
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'lol',
      mood: 'silly',
      pollOptions: null,
      userId: 'u1',
    });
  });

  describe('polls', () => {
    const user = { id: 'u1' } as Identity;
    let log: jest.SpyInstance;

    beforeEach(() => {
      log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
    });
    afterEach(() => jest.restoreAllMocks());

    it('creates a poll and logs it without the question or answers', async () => {
      const created = aQuack({ text: 'Lunch?', poll: aPoll() });
      const repository = mock<QuackRepository>();
      repository.createQuack.mockResolvedValue(created);
      const service = new QuacksService(repository);

      await expect(
        service.createQuack(user, {
          text: 'Lunch?',
          mood: null,
          pollOptions: ['Pizza', 'Thai'],
        }),
      ).resolves.toEqual(created);
      expect(repository.createQuack).toHaveBeenCalledWith(
        expect.objectContaining({ pollOptions: ['Pizza', 'Thai'] }),
      );
      expect(String(log.mock.calls[0][0])).toBe(
        'poll created userId=u1 options=2',
      );
    });

    it('does not log a poll for an ordinary quack', async () => {
      const repository = mock<QuackRepository>();
      repository.createQuack.mockResolvedValue(aQuack());
      const service = new QuacksService(repository);

      await service.createQuack(user, {
        text: 'hi',
        mood: null,
        pollOptions: null,
      });

      expect(log).not.toHaveBeenCalled();
    });

    it.each(['first', 'change', 'same'] as const)(
      'casts the vote as the signed-in user and returns fresh counts (%s)',
      async (outcome) => {
        const fresh = aPoll({ myOptionId: 'o1' });
        const repository = mock<QuackRepository>();
        repository.getPollOptionIds.mockResolvedValue(['o1', 'o2']);
        repository.castVote.mockResolvedValue(outcome);
        repository.getPoll.mockResolvedValue(fresh);
        const service = new QuacksService(repository);

        await expect(service.vote(user, 'q1', 'o1')).resolves.toEqual(fresh);
        expect(repository.castVote).toHaveBeenCalledWith({
          quackId: 'q1',
          userId: 'u1',
          optionId: 'o1',
        });
        expect(repository.getPoll).toHaveBeenCalledWith('q1', 'u1');
        expect(String(log.mock.calls[0][0])).toBe(
          `poll vote userId=u1 quackId=q1 kind=${outcome}`,
        );
      },
    );

    it('refuses a vote on a quack that is not a poll', async () => {
      const repository = mock<QuackRepository>();
      repository.getPollOptionIds.mockResolvedValue(null);
      const service = new QuacksService(repository);

      await expect(service.vote(user, 'q1', 'o1')).rejects.toBeInstanceOf(
        PollNotFoundError,
      );
      expect(repository.castVote).not.toHaveBeenCalled();
    });

    it('refuses an answer that belongs to another poll', async () => {
      const repository = mock<QuackRepository>();
      repository.getPollOptionIds.mockResolvedValue(['o1', 'o2']);
      const service = new QuacksService(repository);

      await expect(
        service.vote(user, 'q1', 'other-poll-option'),
      ).rejects.toBeInstanceOf(PollOptionNotFoundError);
      expect(repository.castVote).not.toHaveBeenCalled();
    });
  });

  describe('searchQuacks', () => {
    const user = { id: 'u1' } as Identity;

    // Keep test output clean; the logging test inspects these calls.
    beforeEach(() =>
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
    );
    afterEach(() => jest.restoreAllMocks());

    it('returns the full feed for an empty or whitespace-only search', async () => {
      const quacks = [aQuack()];
      const repository = mock<QuackRepository>();
      repository.getQuacks.mockResolvedValue(quacks);
      const service = new QuacksService(repository);

      await expect(service.searchQuacks(user, undefined)).resolves.toEqual(
        quacks,
      );
      await expect(service.searchQuacks(user, '   ')).resolves.toEqual(quacks);
      expect(repository.searchQuacks).not.toHaveBeenCalled();
    });

    it('searches by the parsed words', async () => {
      const quacks = [aQuack()];
      const repository = mock<QuackRepository>();
      repository.searchQuacks.mockResolvedValue(quacks);
      const service = new QuacksService(repository);

      await expect(
        service.searchQuacks(user, ' pants  @CaffeinatedDuck '),
      ).resolves.toEqual(quacks);
      expect(repository.searchQuacks).toHaveBeenCalledWith(
        ['pants', 'CaffeinatedDuck'],
        'u1',
      );
    });

    it('logs usage without the search text', async () => {
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      const repository = mock<QuackRepository>();
      repository.searchQuacks.mockResolvedValue([aQuack(), aQuack()]);
      const service = new QuacksService(repository);

      await service.searchQuacks(user, 'secret words');

      expect(log).toHaveBeenCalledTimes(1);
      const message = String(log.mock.calls[0][0]);
      expect(message).toContain('userId=u1');
      expect(message).toContain('words=2');
      expect(message).toContain('results=2');
      expect(message).not.toContain('secret');
    });
  });
});

describe('parseSearchTerm', () => {
  it.each([
    [undefined, []],
    ['', []],
    ['   ', []],
    ['duck', ['duck']],
    ['  pants   duck ', ['pants', 'duck']],
    ['@CaffeinatedDuck', ['CaffeinatedDuck']],
    ['@', []],
  ])('parses %p into %p', (term, words) => {
    expect(parseSearchTerm(term)).toEqual(words);
  });
});
