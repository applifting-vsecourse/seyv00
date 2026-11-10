import { Link } from "@tanstack/react-router"
import { CornerDownRight, Reply as ReplyIcon } from "lucide-react"

import { ROUTES } from "@/app/routes"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/date"
import { cn } from "@/lib/utils"

import type { Reply } from "@/features/quack/api/quackSchemas"
import { QuackDeleteButton } from "@/features/quack/components/QuackDeleteButton"
import { QuackMood } from "@/features/quack/components/QuackMood"
import { QuackPoll } from "@/features/quack/components/QuackPoll"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"

type QuackItemProps = {
  // Any quack someone wrote, a reply included; a placeholder renders elsewhere.
  quack: Reply
  // The author and moderators get the delete action; the server enforces it regardless.
  canDelete?: boolean
  // A moderator deleting someone else's quack; the dialog says whose it is.
  isModerating?: boolean
  // Set inside the app: the time links to the thread and a Reply action shows.
  // Left out on the landing page's static sample.
  onReply?: () => void
  // Says what a reply answers, where it shows up away from its thread ("Mine", search).
  shouldShowParent?: boolean
  // Replies under a quack: a smaller avatar, no divider of their own.
  isCompact?: boolean
  // A hairline below; off when the surrounding thread draws its own.
  hasDivider?: boolean
}

export function QuackItem({
  quack,
  canDelete = false,
  isModerating = false,
  onReply,
  shouldShowParent = false,
  isCompact = false,
  hasDivider = !isCompact,
}: QuackItemProps) {
  const { name, username } = quack.user
  // replies are one level deep, so a reply's thread is its parent
  const threadId = quack.parentId ?? quack.id

  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const time = <time className="text-xs text-muted-foreground">{formatDate(quack.createdAt)}</time>

  return (
    <article
      className={cn(
        "flex w-full gap-4",
        isCompact ? "gap-3 py-2" : "pt-2 pb-4",
        hasDivider && "border-b border-border last:border-b-0",
      )}
    >
      <Avatar className={isCompact ? "size-8" : "size-12"}>
        <AvatarFallback className={isCompact ? "text-xs" : undefined}>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {shouldShowParent && quack.parent ? (
          <Link
            to={ROUTES.thread}
            params={{ quackId: quack.parent.id }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <CornerDownRight className="size-3" />
            {quack.parent.isDeleted || quack.parent.username === null
              ? "reply to a deleted message"
              : `reply to @${quack.parent.username}`}
          </Link>
        ) : null}
        <div className="flex flex-wrap items-baseline gap-2">
          <span>
            <UsersName name={name} /> <UsersUserName username={username} />
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          {onReply ? (
            <Link
              to={ROUTES.thread}
              params={{ quackId: threadId }}
              className="hover:underline"
              aria-label={`Open thread, posted ${formatDate(quack.createdAt)}`}
            >
              {time}
            </Link>
          ) : (
            time
          )}
          {quack.mood ? (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <QuackMood mood={quack.mood} />
            </>
          ) : null}
          {canDelete ? (
            <div className="ml-auto self-center">
              <QuackDeleteButton
                quackId={quack.id}
                authorUsername={isModerating ? username : undefined}
                hasReplies={quack.replyCount > 0}
              />
            </div>
          ) : null}
        </div>
        <p className="text-sm break-words whitespace-pre-line">{quack.text}</p>
        {quack.poll ? (
          <QuackPoll
            quackId={quack.id}
            poll={quack.poll}
          />
        ) : null}
        {onReply ? (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 text-muted-foreground"
              onClick={onReply}
              aria-label={`Reply to @${username}`}
            >
              <ReplyIcon className="size-4" />
              Reply
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}
