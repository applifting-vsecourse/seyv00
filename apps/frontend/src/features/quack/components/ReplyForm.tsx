import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { MoodSelect } from "@/components/MoodSelect"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { moodSchema, type Mood } from "@/lib/moods"
import { cn } from "@/lib/utils"

import { MAX_LENGTH } from "@/features/quack/components/QuackForm"
import { useAddReply } from "@/features/quack/hooks/useAddReply"

// The same rules as a quack, without a poll.
const schema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(MAX_LENGTH, `Keep it under ${MAX_LENGTH} characters`),
  mood: moodSchema.nullable(),
})

type FormValues = z.infer<typeof schema>

type ReplyFormProps = {
  // The top-level quack; a reply to a reply goes into the same thread.
  threadId: string
  // "@username " when answering a particular reply.
  initialText?: string
  // The user's preferred mood from their settings.
  defaultMood?: Mood | null
  onPosted?: () => void
  onCancel?: () => void
  // Grows with every Reply click; anything above 0 puts the cursor in the text.
  focusRequest?: number
  className?: string
}

export function ReplyForm({
  threadId,
  initialText = "",
  defaultMood = null,
  onPosted,
  onCancel,
  focusRequest = 0,
  className,
}: ReplyFormProps) {
  const addReply = useAddReply()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { text: initialText, mood: defaultMood },
  })

  // Every Reply click starts the text over ("@username " for a reply) and
  // focuses it; the chosen mood stays.
  useEffect(() => {
    if (focusRequest === 0) return
    form.reset({ text: initialText, mood: form.getValues("mood") })
    // reset() re-registers the fields on the next render; focus after that
    const timer = setTimeout(() => form.setFocus("text"))
    return () => clearTimeout(timer)
  }, [form, initialText, focusRequest])

  const text = useWatch({ control: form.control, name: "text" })
  const length = text?.length ?? 0

  const handleSubmit = (values: FormValues) => {
    addReply.mutate(
      { threadId, text: values.text, mood: values.mood },
      {
        onSuccess: () => {
          form.reset({ text: "", mood: defaultMood })
          onPosted?.()
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-3", className)}
      >
        {addReply.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addReply.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Your reply</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="Quack back..."
                    disabled={addReply.isPending}
                    {...field}
                    // the cursor goes after a prefilled "@username "
                    onFocus={(event) => {
                      const end = event.currentTarget.value.length
                      event.currentTarget.setSelectionRange(end, end)
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mood"
            render={({ field }) => (
              <FormItem className="sm:w-40">
                <FormLabel>Mood</FormLabel>
                <MoodSelect
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  isDisabled={addReply.isPending}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <span
            className={cn(
              "text-sm",
              length > MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {length}/{MAX_LENGTH}
          </span>
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={addReply.isPending}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={addReply.isPending}
          >
            {addReply.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Post reply
          </Button>
        </div>
      </form>
    </Form>
  )
}
