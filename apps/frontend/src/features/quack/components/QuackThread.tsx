import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, RefreshCw, Reply as ReplyIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { Mood } from "@/lib/moods"

import type { Quack, Reply } from "@/features/quack/api/quackSchemas"
import { threadQueryOptions } from "@/features/quack/api/threadQueryOptions"
import { QuackItem } from "@/features/quack/components/QuackItem"
import { ReplyForm } from "@/features/quack/components/ReplyForm"

type QuackThreadProps = {
  quack: Quack
  // The signed-in user; their own quacks and replies get a delete action.
  currentUserId?: string
  // A moderator (admin) gets the delete action on everyone's.
  canModerate?: boolean
  // Preselected in the reply form.
  defaultMood?: Mood | null
  // The thread page: every reply is already here and the reply form stays open.
  isFullThread?: boolean
  // A reply listed on its own ("Mine", search) says what it answers.
  shouldShowParent?: boolean
}

export function QuackThread({
  quack,
  currentUserId,
  canModerate = false,
  defaultMood,
  isFullThread = false,
  shouldShowParent = false,
}: QuackThreadProps) {
  // replies are one level deep, so a reply's thread is its parent
  const threadId = quack.parentId ?? quack.id
  // null: the form is closed. Otherwise what it starts with, and how many times
  // Reply was clicked, so every click puts the cursor back in the form.
  const [reply, setReply] = useState<{ text: string; focusRequest: number } | null>(
    isFullThread ? { text: "", focusRequest: 0 } : null,
  )
  const openReply = (text: string) =>
    setReply((previous) => ({ text, focusRequest: (previous?.focusRequest ?? 0) + 1 }))
  const [isExpanded, setIsExpanded] = useState(false)

  // "Show more replies" loads the whole thread; the feed only carries the first few.
  const threadQuery = useQuery({
    ...threadQueryOptions(threadId),
    enabled: isExpanded && !isFullThread,
  })
  const replies = isExpanded && threadQuery.data ? threadQuery.data.replies : quack.replies
  const hiddenCount = quack.replyCount - replies.length

  const deleteProps = (item: Reply) => {
    const isOwn = currentUserId !== undefined && item.userId === currentUserId
    return { canDelete: isOwn || canModerate, isModerating: !isOwn && canModerate }
  }

  return (
    <div className="flex flex-col border-b border-border pb-2 last:border-b-0">
      {quack.isDeleted ? (
        // nothing of the author or their text is left; the thread stays open
        <article className="flex items-center justify-between gap-3 pt-2 pb-2">
          <p className="text-sm text-muted-foreground italic">This message was deleted</p>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => openReply("")}
            aria-label="Reply to this thread"
          >
            <ReplyIcon className="size-4" />
            Reply
          </Button>
        </article>
      ) : (
        <QuackItem
          quack={quack}
          {...deleteProps(quack)}
          shouldShowParent={shouldShowParent}
          onReply={() => openReply(quack.parentId ? `@${quack.user.username} ` : "")}
          hasDivider={false}
        />
      )}

      {replies.length > 0 || hiddenCount > 0 || reply !== null ? (
        <div className="flex flex-col gap-1 pb-2 pl-16">
          {replies.map((item) => (
            <QuackItem
              key={item.id}
              quack={item}
              {...deleteProps(item)}
              onReply={() => openReply(`@${item.user.username} `)}
              isCompact
            />
          ))}

          {hiddenCount > 0 && !isFullThread ? (
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 text-muted-foreground"
                onClick={() => setIsExpanded(true)}
                disabled={threadQuery.isFetching}
              >
                {threadQuery.isFetching ? <Loader2 className="size-4 animate-spin" /> : null}
                Show more replies ({hiddenCount})
              </Button>
            </div>
          ) : null}

          {isExpanded && threadQuery.error ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>Couldn&apos;t load the replies. {threadQuery.error.message}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void threadQuery.refetch()}
                >
                  <RefreshCw className="size-4" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {reply !== null ? (
            <ReplyForm
              threadId={threadId}
              initialText={reply.text}
              focusRequest={reply.focusRequest}
              defaultMood={defaultMood}
              className="pt-2"
              onPosted={() => {
                // the new reply comes last, so show the whole thread
                setIsExpanded(true)
                // the thread page keeps its form; the feed closes it
                setReply(isFullThread ? { text: "", focusRequest: 0 } : null)
              }}
              onCancel={isFullThread ? undefined : () => setReply(null)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
