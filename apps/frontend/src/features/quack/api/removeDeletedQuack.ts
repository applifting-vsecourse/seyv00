import type { Quack } from "@/features/quack/api/quackSchemas"

/**
 * What a list of quacks looks like once `deletedId` is deleted, mirroring the
 * server so the screen doesn't flicker before the refetch confirms it:
 *
 * - a top-level quack with replies becomes a placeholder, its replies stay;
 * - anything else leaves the list;
 * - a reply leaves its thread, and a placeholder left without replies goes too.
 */
export function removeDeletedQuack(quacks: Quack[], deletedId: string): Quack[] {
  return quacks.flatMap((quack): Quack[] => {
    if (quack.id === deletedId) {
      if (quack.parentId !== null || quack.replyCount === 0) return []
      return [
        {
          id: quack.id,
          createdAt: quack.createdAt,
          parentId: null,
          parent: null,
          replyCount: quack.replyCount,
          replies: quack.replies,
          isDeleted: true,
        },
      ]
    }

    if (!quack.replies.some((reply) => reply.id === deletedId)) return [quack]
    const replyCount = quack.replyCount - 1
    if (quack.isDeleted && replyCount === 0) return []
    return [
      {
        ...quack,
        replyCount,
        replies: quack.replies.filter((reply) => reply.id !== deletedId),
      },
    ]
  })
}
