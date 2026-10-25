import { useState } from "react"
import { Loader2, Trash2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

import { useDeleteQuack } from "@/features/quack/hooks/useDeleteQuack"

type QuackDeleteButtonProps = {
  quackId: string
  // Set when a moderator deletes someone else's quack.
  authorUsername?: string
}

// Asks first; on success the quack leaves the feed and this unmounts with it.
export function QuackDeleteButton({ quackId, authorUsername }: QuackDeleteButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const deleteQuack = useDeleteQuack()

  const handleOpenChange = (shouldOpen: boolean) => {
    if (deleteQuack.isPending) return
    setIsOpen(shouldOpen)
    // a reopened dialog shouldn't show the last attempt's error
    deleteQuack.reset()
  }

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete quack"
          className="text-muted-foreground"
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {authorUsername ? `Delete @${authorUsername}'s quack?` : "Delete this quack?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {authorUsername ? "You're removing it as a moderator. " : null}It disappears from the
            feed for everyone, together with any poll votes. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteQuack.error ? (
          <Alert variant="destructive">
            <AlertDescription>{deleteQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteQuack.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteQuack.isPending}
            onClick={(event) => {
              // stay open until the server answers, so an error has somewhere to show
              event.preventDefault()
              deleteQuack.mutate(quackId)
            }}
          >
            {deleteQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
