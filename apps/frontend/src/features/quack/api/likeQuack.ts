// Likes (cases.md, ADR 0002). Not implemented yet: these stubs only fix the
// shape the component tests mock.

// A quack's likes after a like or unlike, seen by the one who sent it.
export type LikeState = {
  likeCount: number
  likedByMe: boolean
}

// PUT /api/quacks/:id/like
export function likeQuack(_quackId: string): Promise<LikeState> {
  return Promise.reject(new Error("not implemented"))
}

// DELETE /api/quacks/:id/like
export function unlikeQuack(_quackId: string): Promise<LikeState> {
  return Promise.reject(new Error("not implemented"))
}
