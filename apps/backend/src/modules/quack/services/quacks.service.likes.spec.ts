// Likes: the rules the service owns (cases.md, R1–R11). The repository is
// mocked. "Only once" and the counts themselves are kept by the database
// (ADR 0002), so the integration tests (A2–A4, A7–A9) prove those against a
// real one. Here: whose like it is, and what can't be liked.
import { LikeState, QuackNotFoundError } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { mock } from 'jest-mock-extended';
import { QuacksService } from './quacks.service';

const me = { id: 'me', role: 'user' } as Identity;
const admin = { id: 'admin', role: 'admin' } as Identity;

const likes = (likeCount: number, likedByMe: boolean): LikeState => ({
  likeCount,
  likedByMe,
});

const setup = (): {
  repository: ReturnType<typeof mock<QuackRepository>>;
  service: QuacksService;
} => {
  const repository = mock<QuackRepository>();
  const service = new QuacksService(repository);
  return { repository, service };
};

describe('QuacksService likes', () => {
  describe('liking', () => {
    it('R1: likes a quack as the signed-in user', async () => {
      const { repository, service } = setup();
      repository.likeQuack.mockResolvedValue(likes(1, true));

      await expect(service.likeQuack(me, 'q1')).resolves.toEqual(
        likes(1, true),
      );
      // the user comes from the session, never from the request
      expect(repository.likeQuack).toHaveBeenCalledWith('q1', 'me');
    });

    it('R2: liking a quack again is no error and returns the same state', async () => {
      const { repository, service } = setup();
      // already liked: the repository adds nothing
      repository.likeQuack.mockResolvedValue(likes(1, true));

      await expect(service.likeQuack(me, 'q1')).resolves.toEqual(
        likes(1, true),
      );
      await expect(service.likeQuack(me, 'q1')).resolves.toEqual(
        likes(1, true),
      );
    });

    it('R3: takes the like back as the signed-in user', async () => {
      const { repository, service } = setup();
      repository.unlikeQuack.mockResolvedValue(likes(0, false));

      await expect(service.unlikeQuack(me, 'q1')).resolves.toEqual(
        likes(0, false),
      );
      expect(repository.unlikeQuack).toHaveBeenCalledWith('q1', 'me');
    });

    it('R4: taking back a like that is not there is no error', async () => {
      const { repository, service } = setup();
      repository.unlikeQuack.mockResolvedValue(likes(0, false));

      await expect(service.unlikeQuack(me, 'q1')).resolves.toEqual(
        likes(0, false),
      );
    });

    it('R5: the author can like their own quack', async () => {
      const { repository, service } = setup();
      repository.likeQuack.mockResolvedValue(likes(1, true));

      await expect(service.likeQuack(me, 'my-quack')).resolves.toEqual(
        likes(1, true),
      );
      // no author check: liking doesn't ask who wrote the quack
      expect(repository.getDeleteTarget).not.toHaveBeenCalled();
    });

    it('R6: a reply can be liked like any quack', async () => {
      const { repository, service } = setup();
      repository.likeQuack.mockResolvedValue(likes(1, true));

      await expect(service.likeQuack(me, 'reply-1')).resolves.toEqual(
        likes(1, true),
      );
      // no "is it a reply" check, unlike replying
      expect(repository.getReplyTarget).not.toHaveBeenCalled();
      expect(repository.likeQuack).toHaveBeenCalledWith('reply-1', 'me');
    });
  });

  describe('whose like', () => {
    it('R7: liked-by-me is about the user asking, even when others liked it', async () => {
      const { repository, service } = setup();
      // someone else's like counts, but it isn't mine
      repository.unlikeQuack.mockResolvedValue(likes(1, false));

      await expect(service.unlikeQuack(me, 'q1')).resolves.toEqual(
        likes(1, false),
      );
      expect(repository.unlikeQuack).toHaveBeenCalledWith('q1', 'me');
    });

    it('R8: taking my like back removes only mine', async () => {
      const { repository, service } = setup();
      repository.unlikeQuack.mockResolvedValue(likes(1, false));

      await expect(service.unlikeQuack(me, 'q1')).resolves.toEqual(
        likes(1, false),
      );
      expect(repository.unlikeQuack).toHaveBeenCalledTimes(1);
      expect(repository.unlikeQuack).toHaveBeenCalledWith('q1', 'me');
    });

    it("R9: an admin can't remove someone else's like, only their own", async () => {
      const { repository, service } = setup();
      repository.unlikeQuack.mockResolvedValue(likes(1, false));

      await expect(service.unlikeQuack(admin, 'q1')).resolves.toEqual(
        likes(1, false),
      );
      expect(repository.unlikeQuack).toHaveBeenCalledTimes(1);
      expect(repository.unlikeQuack).toHaveBeenCalledWith('q1', 'admin');
    });
  });

  describe("what can't be liked", () => {
    it('R10: a quack that does not exist is not found, for like and unlike', async () => {
      const { repository, service } = setup();
      repository.likeQuack.mockResolvedValue(null);
      repository.unlikeQuack.mockResolvedValue(null);

      await expect(service.likeQuack(me, 'missing')).rejects.toBeInstanceOf(
        QuackNotFoundError,
      );
      await expect(service.unlikeQuack(me, 'missing')).rejects.toBeInstanceOf(
        QuackNotFoundError,
      );
    });

    it('R11: a deleted message (placeholder) is not found, for like and unlike', async () => {
      const { repository, service } = setup();
      // the repository reports a placeholder the same way as a missing quack
      repository.likeQuack.mockResolvedValue(null);
      repository.unlikeQuack.mockResolvedValue(null);

      await expect(service.likeQuack(me, 'placeholder')).rejects.toBeInstanceOf(
        QuackNotFoundError,
      );
      await expect(
        service.unlikeQuack(me, 'placeholder'),
      ).rejects.toBeInstanceOf(QuackNotFoundError);
      expect(repository.likeQuack).toHaveBeenCalledWith('placeholder', 'me');
    });
  });
});
