import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"

import type { Poll } from "@/features/quack/api/quackSchemas"
import { useVote } from "@/features/quack/hooks/useVote"

export const formatVotes = (count: number) =>
  count === 0 ? "No votes yet" : count === 1 ? "1 vote" : `${count} votes`

const percentOf = (votes: number, total: number) =>
  total === 0 ? 0 : Math.round((votes / total) * 100)

type QuackPollProps = { quackId: string; poll: Poll }

export function QuackPoll({ quackId, poll }: QuackPollProps) {
  const { displayed, hasFailed, vote } = useVote(quackId, poll)

  // Per-answer counts stay hidden until you've voted, so they can't sway you.
  // The author always sees them.
  const canSeeResults = displayed.myOptionId !== null || displayed.isAuthor

  return (
    <div className="flex flex-col gap-2">
      <ul
        aria-label="Poll answers"
        className="flex flex-col gap-2"
      >
        {displayed.options.map((option) => {
          const isChosen = option.id === displayed.myOptionId
          const percent = percentOf(option.votes, displayed.totalVotes)

          return (
            <li key={option.id}>
              <Button
                type="button"
                variant="outline"
                aria-pressed={isChosen}
                // Changing your mind moves the vote; picking the same answer again does nothing.
                onClick={() => {
                  if (!isChosen) vote(option.id)
                }}
                className="relative h-auto w-full justify-between gap-3 overflow-hidden py-2 text-left whitespace-normal"
              >
                {canSeeResults ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 bg-secondary transition-[width]"
                    // A data-driven width, not a spacing value, so it can't come from the scale.
                    style={{ width: `${percent}%` }}
                  />
                ) : null}
                <span className="relative flex items-center gap-2">
                  {isChosen ? <Check className="size-4 shrink-0" /> : null}
                  <span className={isChosen ? "font-medium" : undefined}>{option.text}</span>
                </span>
                {canSeeResults ? (
                  <span className="relative shrink-0 text-sm text-muted-foreground">
                    {percent}% · {option.votes}
                  </span>
                ) : null}
              </Button>
            </li>
          )
        })}
      </ul>

      <p className="text-xs text-muted-foreground">{formatVotes(displayed.totalVotes)}</p>

      {hasFailed ? (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          Your vote didn&apos;t go through. Try again.
        </p>
      ) : null}
    </div>
  )
}
