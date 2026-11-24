// Likes over real HTTP against the quacker_test database (cases.md, A1–A15).
import { PrismaService } from '@/core/prisma/prisma.service';
import {
  createTestApp,
  resetDatabase,
  signUp,
} from '@/test/integration/test-app';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

type Agent = Awaited<ReturnType<typeof signUp>>;

type QuackBody = {
  id: string;
  isDeleted: boolean;
  likeCount: number;
  likedByMe: boolean;
  replies: QuackBody[];
};

describe('Likes API', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // --- helpers ---------------------------------------------------------------

  const signUpAs = (name: string): Promise<Agent> =>
    signUp(app, { email: `${name}@example.com`, name });

  const post = async (agent: Agent, text: string): Promise<string> => {
    const response = await agent.post('/api/quacks').send({ text }).expect(201);
    return response.body.id as string;
  };

  const reply = async (
    agent: Agent,
    quackId: string,
    text: string,
  ): Promise<string> => {
    const response = await agent
      .post(`/api/quacks/${quackId}/replies`)
      .send({ text })
      .expect(201);
    return response.body.id as string;
  };

  const feed = async (agent: Agent, query = ''): Promise<QuackBody[]> => {
    const response = await agent.get(`/api/quacks${query}`).expect(200);
    return response.body as QuackBody[];
  };

  const inFeed = async (agent: Agent, quackId: string): Promise<QuackBody> => {
    const quack = (await feed(agent)).find(({ id }) => id === quackId);
    if (!quack) throw new Error(`quack ${quackId} is not in the feed`);
    return quack;
  };

  // Straight from the table (ADR 0002), to see what the database keeps.
  const likesInDb = async (quackId: string): Promise<number> => {
    const [row] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "quack_like" WHERE "quackId" = ${quackId}`;
    return Number(row.count);
  };

  const userId = async (name: string): Promise<string> => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: `${name}@example.com` },
    });
    return user.id;
  };

  // --- signed in or not ------------------------------------------------------

  it('A1: a signed-out visitor gets 401 and the count does not change', async () => {
    const author = await signUpAs('author');
    const quackId = await post(author, 'hello');
    const visitor = request(app.getHttpServer());

    await visitor.put(`/api/quacks/${quackId}/like`).expect(401);
    await visitor.delete(`/api/quacks/${quackId}/like`).expect(401);

    expect(await inFeed(author, quackId)).toMatchObject({
      likeCount: 0,
      likedByMe: false,
    });
  });

  // --- like and take back ----------------------------------------------------

  it('A2: liking answers the new state and the feed shows it', async () => {
    const author = await signUpAs('author');
    const quackId = await post(author, 'hello');
    const me = await signUpAs('me');

    const response = await me.put(`/api/quacks/${quackId}/like`).expect(200);

    expect(response.body).toEqual({ likeCount: 1, likedByMe: true });
    expect(await inFeed(me, quackId)).toMatchObject({
      likeCount: 1,
      likedByMe: true,
    });
  });

  it('A3: liking twice keeps one like', async () => {
    const author = await signUpAs('author');
    const quackId = await post(author, 'hello');
    const me = await signUpAs('me');

    await me.put(`/api/quacks/${quackId}/like`).expect(200);
    const again = await me.put(`/api/quacks/${quackId}/like`).expect(200);

    expect(again.body).toEqual({ likeCount: 1, likedByMe: true });
    expect(await likesInDb(quackId)).toBe(1);
  });

  it('A4: taking the like back, also twice, answers 200 with the state', async () => {
    const author = await signUpAs('author');
    const quackId = await post(author, 'hello');
    const me = await signUpAs('me');
    await me.put(`/api/quacks/${quackId}/like`).expect(200);

    const first = await me.delete(`/api/quacks/${quackId}/like`).expect(200);
    const second = await me.delete(`/api/quacks/${quackId}/like`).expect(200);

    expect(first.body).toEqual({ likeCount: 0, likedByMe: false });
    expect(second.body).toEqual({ likeCount: 0, likedByMe: false });
  });

  it('A5: another user sees the count but not as their like, and no list of who liked', async () => {
    const author = await signUpAs('author');
    const quackId = await post(author, 'hello');
    const me = await signUpAs('me');
    await me.put(`/api/quacks/${quackId}/like`).expect(200);

    const quack = await inFeed(author, quackId);

    expect(quack).toMatchObject({ likeCount: 1, likedByMe: false });
    expect(quack).not.toHaveProperty('likes');
  });

  it('A6: my own quack and a reply can both be liked, in the feed and the thread', async () => {
    const me = await signUpAs('me');
    const quackId = await post(me, 'my quack');
    const replyId = await reply(me, quackId, 'my reply');

    await me.put(`/api/quacks/${quackId}/like`).expect(200);
    await me.put(`/api/quacks/${replyId}/like`).expect(200);

    const quack = await inFeed(me, quackId);
    expect(quack).toMatchObject({ likeCount: 1, likedByMe: true });
    expect(quack.replies[0]).toMatchObject({
      id: replyId,
      likeCount: 1,
      likedByMe: true,
    });

    const thread = (await me.get(`/api/quacks/${quackId}`).expect(200))
      .body as QuackBody;
    expect(thread).toMatchObject({ likeCount: 1, likedByMe: true });
    expect(thread.replies[0]).toMatchObject({ likeCount: 1, likedByMe: true });
  });

  it("A7: an admin's unlike doesn't remove someone else's like", async () => {
    const author = await signUpAs('author');
    const quackId = await post(author, 'hello');
    const b = await signUpAs('b');
    await b.put(`/api/quacks/${quackId}/like`).expect(200);
    const admin = await signUpAs('admin');
    await prisma.user.update({
      where: { id: await userId('admin') },
      data: { role: 'admin' },
    });

    const response = await admin
      .delete(`/api/quacks/${quackId}/like`)
      .expect(200);

    expect(response.body).toEqual({ likeCount: 1, likedByMe: false });
    expect(await inFeed(b, quackId)).toMatchObject({
      likeCount: 1,
      likedByMe: true,
    });
  });

  // --- at the same time ------------------------------------------------------

  it('A8: two people liking at the same moment end at 2', async () => {
    const author = await signUpAs('author');
    const quackId = await post(author, 'hello');
    const a = await signUpAs('a');
    const b = await signUpAs('b');

    const responses = await Promise.all([
      a.put(`/api/quacks/${quackId}/like`),
      b.put(`/api/quacks/${quackId}/like`),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    expect(await inFeed(author, quackId)).toMatchObject({ likeCount: 2 });
  });

  it('A9: the same person liking twice at the same moment ends at 1', async () => {
    const author = await signUpAs('author');
    const quackId = await post(author, 'hello');
    const me = await signUpAs('me');

    const responses = await Promise.all([
      me.put(`/api/quacks/${quackId}/like`),
      me.put(`/api/quacks/${quackId}/like`),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    for (const response of responses) {
      expect(response.body).toEqual({ likeCount: 1, likedByMe: true });
    }
    expect(await likesInDb(quackId)).toBe(1);
  });

  // --- what can't be liked ---------------------------------------------------

  it('A10: a quack that does not exist answers 404', async () => {
    const me = await signUpAs('me');

    await me.put('/api/quacks/no-such-quack/like').expect(404);
    await me.delete('/api/quacks/no-such-quack/like').expect(404);
  });

  it('A11: a deleted message loses its likes, shows none and answers 404', async () => {
    const author = await signUpAs('author');
    const quackId = await post(author, 'soon deleted');
    const other = await signUpAs('other');
    await reply(other, quackId, 'a reply keeps the thread');
    await author.put(`/api/quacks/${quackId}/like`).expect(200);
    await other.put(`/api/quacks/${quackId}/like`).expect(200);

    await author.delete(`/api/quacks/${quackId}`).expect(204);

    expect(await likesInDb(quackId)).toBe(0);
    expect(await inFeed(other, quackId)).toMatchObject({
      isDeleted: true,
      likeCount: 0,
      likedByMe: false,
    });
    expect(
      (await other.get(`/api/quacks/${quackId}`).expect(200)).body,
    ).toMatchObject({ isDeleted: true, likeCount: 0, likedByMe: false });
    await other.put(`/api/quacks/${quackId}/like`).expect(404);
    await other.delete(`/api/quacks/${quackId}/like`).expect(404);
  });

  // --- likes go with what they belong to -------------------------------------

  it('A12: deleting a quack or a reply deletes their likes', async () => {
    const author = await signUpAs('author');
    const lonelyId = await post(author, 'no replies');
    const threadId = await post(author, 'has a reply');
    const replyId = await reply(author, threadId, 'the reply');
    const me = await signUpAs('me');
    await me.put(`/api/quacks/${lonelyId}/like`).expect(200);
    await me.put(`/api/quacks/${replyId}/like`).expect(200);

    await author.delete(`/api/quacks/${lonelyId}`).expect(204);
    await author.delete(`/api/quacks/${replyId}`).expect(204);

    expect(await likesInDb(lonelyId)).toBe(0);
    expect(await likesInDb(replyId)).toBe(0);
  });

  it("A13: a removed account's likes drop out of the count", async () => {
    const author = await signUpAs('author');
    const quackId = await post(author, 'hello');
    const b = await signUpAs('b');
    await b.put(`/api/quacks/${quackId}/like`).expect(200);

    await prisma.user.delete({ where: { id: await userId('b') } });

    expect(await inFeed(author, quackId)).toMatchObject({ likeCount: 0 });
    expect(await likesInDb(quackId)).toBe(0);
  });

  // --- nothing else changes --------------------------------------------------

  it('A14: liking does not change the order of the feed, Mine or search', async () => {
    const me = await signUpAs('me');
    const q1 = await post(me, 'zebra one');
    const q2 = await post(me, 'zebra two');
    const q3 = await post(me, 'zebra three');

    await me.put(`/api/quacks/${q1}/like`).expect(200);

    for (const query of ['', '?mine=true', '?q=zebra']) {
      const ids = (await feed(me, query)).map(({ id }) => id);
      expect(ids).toEqual([q3, q2, q1]);
    }
  });

  it('A15: a liked quack shows its likes in the feed, Mine, search and its thread', async () => {
    const me = await signUpAs('me');
    const quackId = await post(me, 'giraffe');
    await me.put(`/api/quacks/${quackId}/like`).expect(200);

    for (const query of ['', '?mine=true', '?q=giraffe']) {
      const quack = (await feed(me, query)).find(({ id }) => id === quackId);
      expect({ query, ...quack }).toMatchObject({
        query,
        likeCount: 1,
        likedByMe: true,
      });
    }
    expect(
      (await me.get(`/api/quacks/${quackId}`).expect(200)).body,
    ).toMatchObject({ likeCount: 1, likedByMe: true });
  });
});
