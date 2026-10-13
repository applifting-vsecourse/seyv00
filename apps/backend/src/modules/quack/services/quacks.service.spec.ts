// Example unit test — the pattern to copy for your own services.
// The repository is mocked, so the test exercises the service in isolation.
import { Quack } from '@/modules/quack/domain/quack';
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
  ...overrides,
});

describe('QuacksService', () => {
  it('returns quacks from the repository', async () => {
    const quacks = [aQuack()];
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue(quacks);

    const service = new QuacksService(repository);

    await expect(service.getQuacks()).resolves.toEqual(quacks);
    expect(repository.getQuacks).toHaveBeenCalledTimes(1);
  });

  it('creates a quack owned by the signed-in user', async () => {
    const created = aQuack({ id: 'q2', text: 'hello' });
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(created);

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await expect(
      service.createQuack(user, { text: 'hello', mood: null }),
    ).resolves.toEqual(created);
    // the author comes from the session, not from the caller's payload
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'hello',
      mood: null,
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
      service.createQuack(user, { text: 'lol', mood: 'silly' }),
    ).resolves.toEqual(created);
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'lol',
      mood: 'silly',
      userId: 'u1',
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
      expect(repository.searchQuacks).toHaveBeenCalledWith([
        'pants',
        'CaffeinatedDuck',
      ]);
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
