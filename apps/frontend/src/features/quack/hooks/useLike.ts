import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { HTTPError } from "@/lib/api-client"

import { likeQuack, unlikeQuack, type LikeState } from "@/features/quack/api/likeQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"

/** The quack, or one of its replies, with `quackId`'s likes set to `likes`. */
function withLikes(quack: Quack, quackId: string, likes: LikeState): Quack {
  const replies = quack.replies.map((reply) =>
    reply.id === quackId ? { ...reply, ...likes } : reply,
  )
  if (quack.id === quackId && !quack.isDeleted) return { ...quack, ...likes, replies }
  return { ...quack, replies }
}

/**
 * Liking one quack. Like a poll vote (see useVote), the query cache only holds
 * what the server said and the like in flight is drawn on top of it, so it
 * shows straight away and a refused like simply stops being drawn.
 */
export function useLike(quackId: string, likeCount: number, isLikedByMe: boolean) {
  const queryClient = useQueryClient()
  const mutationKey = quackKeys.like(quackId)

  const like = useMutation({
    mutationKey,
    // One request at a time per quack, in click order, so the last click wins.
    scope: { id: mutationKey.join(":") },
    mutationFn: (shouldLike: boolean) => (shouldLike ? likeQuack(quackId) : unlikeQuack(quackId)),
    onSuccess: (fresh) => {
      // the quack shows in the feed, "Mine", search and its thread
      queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
        quacks?.map((quack) => withLikes(quack, quackId, fresh)),
      )
      queryClient.setQueriesData<Quack>({ queryKey: quackKeys.threads() }, (thread) =>
        thread ? withLikes(thread, quackId, fresh) : thread,
      )
    },
    onError: async (error) => {
      const isGone = error instanceof HTTPError && error.response.status === 404
      toast.error(isGone ? "This quack doesn't exist anymore" : error.message)
      // it may be gone, or someone else changed it: show what the server has
      await queryClient.invalidateQueries({ queryKey: quackKeys.all() })
    },
  })

  // Mutations come back in the order they were started.
  const pending = useMutationState({
    filters: { mutationKey, status: "pending" },
    select: (mutation) => mutation.state.variables as boolean,
  })
  const shouldLike = pending.at(-1)

  if (shouldLike === undefined || shouldLike === isLikedByMe) {
    return { likeCount, isLikedByMe, toggle: () => like.mutate(!isLikedByMe) }
  }
  const shown = {
    likeCount: Math.max(0, likeCount + (shouldLike ? 1 : -1)),
    isLikedByMe: shouldLike,
  }
  return { ...shown, toggle: () => like.mutate(!shown.isLikedByMe) }
}
