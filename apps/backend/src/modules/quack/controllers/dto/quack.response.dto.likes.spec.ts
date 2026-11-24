// Likes in the API response (cases.md R7, decision 5): every quack carries
// its count and whether the viewer liked it, never who liked it.
import { Quack } from '@/modules/quack/domain/quack';
import { QuackResponseDto } from './quack.response.dto';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'quack quack',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  poll: null,
  isDeleted: false,
  parentId: null,
  parent: null,
  replyCount: 0,
  replies: [],
  likeCount: 0,
  likedByMe: false,
  ...overrides,
});

describe('QuackResponseDto likes', () => {
  it("R7: shows the count and the viewer's own like, not who liked it", () => {
    const dto = QuackResponseDto.fromDomain(
      aQuack({ likeCount: 1, likedByMe: false }),
    );

    expect(dto).toMatchObject({ likeCount: 1, likedByMe: false });
    expect(dto).not.toHaveProperty('likes');
  });

  it('R7: shows likes on the replies too', () => {
    const reply = aQuack({
      id: 'r1',
      parentId: 'q1',
      likeCount: 2,
      likedByMe: true,
    });

    const dto = QuackResponseDto.fromDomain(
      aQuack({ replyCount: 1, replies: [reply] }),
    );

    expect(dto.replies[0]).toMatchObject({ likeCount: 2, likedByMe: true });
  });
});
