import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll, Quack } from "@/features/quack/api/quackSchemas"
import { votePoll } from "@/features/quack/api/votePoll"

/** The poll as it looks once `optionId` is the viewer's vote. */
export function applyVote(poll: Poll, optionId: string): Poll {
  if (poll.myOptionId === optionId) return poll
  const isFirstVote = poll.myOptionId === null
  return {
    ...poll,
    options: poll.options.map((option) => {
      if (option.id === optionId) return { ...option, votes: option.votes + 1 }
      if (option.id === poll.myOptionId) return { ...option, votes: Math.max(0, option.votes - 1) }
      return option
    }),
    totalVotes: isFirstVote ? poll.totalVotes + 1 : poll.totalVotes,
    myOptionId: optionId,
  }
}

/**
 * Voting in one poll. The query cache only ever holds what the server said;
 * the vote in flight is drawn on top of it (see `displayed`), so a focus
 * refetch can't wipe it and a failed vote simply stops being drawn.
 */
export function useVote(quackId: string, poll: Poll) {
  const queryClient = useQueryClient()
  const mutationKey = quackKeys.vote(quackId)

  const vote = useMutation({
    mutationKey,
    // One request at a time per poll, in click order, so the last click wins.
    scope: { id: mutationKey.join(":") },
    mutationFn: (optionId: string) => votePoll(quackId, optionId),
    onSuccess: (fresh) => {
      queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
        quacks?.map((quack) => (quack.id === quackId ? { ...quack, poll: fresh } : quack)),
      )
    },
  })

  // Mutations come back in the order they were started.
  const pendingOptionIds = useMutationState({
    filters: { mutationKey, status: "pending" },
    select: (mutation) => mutation.state.variables as string,
  })
  const settledStatuses = useMutationState({
    filters: { mutationKey, predicate: (mutation) => mutation.state.status !== "pending" },
    select: (mutation) => mutation.state.status,
  })

  const latestPending = pendingOptionIds.at(-1)

  return {
    displayed: latestPending ? applyVote(poll, latestPending) : poll,
    // shown until a later vote succeeds
    hasFailed: settledStatuses.at(-1) === "error",
    vote: (optionId: string) => vote.mutate(optionId),
  }
}
