import { Heart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useLike } from "@/features/quack/hooks/useLike"

type QuackLikeButtonProps = {
  quackId: string
  likeCount: number
  isLikedByMe: boolean
}

// A heart, filled once you like the quack, with the count from 1 up.
export function QuackLikeButton({ quackId, likeCount, isLikedByMe }: QuackLikeButtonProps) {
  const like = useLike(quackId, likeCount, isLikedByMe)

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(like.isLikedByMe ? "text-foreground" : "text-muted-foreground")}
      onClick={like.toggle}
      aria-label={like.isLikedByMe ? "Unlike" : "Like"}
      aria-pressed={like.isLikedByMe}
    >
      <Heart className={cn("size-4", like.isLikedByMe && "fill-current")} />
      {like.likeCount > 0 ? <span>{like.likeCount}</span> : null}
    </Button>
  )
}
