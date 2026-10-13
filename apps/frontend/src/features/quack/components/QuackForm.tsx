import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, X } from "lucide-react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { moodSchema, type Mood } from "@/lib/moods"
import { cn } from "@/lib/utils"

import { useAddQuack } from "@/features/quack/hooks/useAddQuack"

// Mirrors the server-side DTO (MaxLength(280)) so the user is told before
// the request is made — the server still validates independently.
const MAX_LENGTH = 280

// Poll rules, mirrored from the server-side DTO.
const POLL_MIN_OPTIONS = 2
const POLL_MAX_OPTIONS = 4
const POLL_OPTION_MAX_LENGTH = 50

// Counted in characters, like the server and the database, so an emoji is
// one — zod's own .max() would count it as two.
const characterCount = (text: string) => [...text].length

const answerSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write an answer")
    .refine(
      (text) => characterCount(text) <= POLL_OPTION_MAX_LENGTH,
      `Keep it under ${POLL_OPTION_MAX_LENGTH} characters`,
    ),
})

const schema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(MAX_LENGTH, `Keep it under ${MAX_LENGTH} characters`),
  mood: moodSchema.nullable(),
  // No answers means an ordinary quack; the buttons below keep it at 0 or 2–4.
  pollOptions: z
    .array(answerSchema)
    .max(POLL_MAX_OPTIONS)
    .superRefine((options, ctx) => {
      const seen = new Set<string>()
      options.forEach((option, index) => {
        const key = option.text.toLowerCase()
        if (key && seen.has(key)) {
          ctx.addIssue({
            code: "custom",
            message: "Answers must be different",
            path: [index, "text"],
          })
        }
        seen.add(key)
      })
    }),
})

type FormValues = z.infer<typeof schema>

type QuackFormProps = {
  // The user's preferred mood from their settings; each new quack starts with it.
  defaultMood?: Mood | null
  className?: string
  onPosted?: () => void
}

export function QuackForm({ defaultMood = null, className, onPosted }: QuackFormProps) {
  const addQuack = useAddQuack()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { text: "", mood: defaultMood, pollOptions: [] },
  })
  const pollOptions = useFieldArray({ control: form.control, name: "pollOptions" })
  const isPoll = pollOptions.fields.length > 0

  const text = useWatch({ control: form.control, name: "text" })
  const length = text?.length ?? 0

  const handleSubmit = (values: FormValues) => {
    addQuack.mutate(
      {
        text: values.text,
        mood: values.mood,
        poll: values.pollOptions.length
          ? { options: values.pollOptions.map((option) => option.text) }
          : null,
      },
      {
        onSuccess: () => {
          // back to the preferred mood and an ordinary quack
          form.reset({ text: "", mood: defaultMood, pollOptions: [] })
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
        {addQuack.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>New quack</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder={isPoll ? "Ask a question..." : "Quack something..."}
                    disabled={addQuack.isPending}
                    {...field}
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
                  isDisabled={addQuack.isPending}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {isPoll ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-medium">Poll answers</legend>
            {pollOptions.fields.map((option, index) => (
              <FormField
                key={option.id}
                control={form.control}
                name={`pollOptions.${index}.text`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Answer {index + 1}</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder={index === 0 ? "e.g. Pizza" : undefined}
                          disabled={addQuack.isPending}
                          {...field}
                        />
                      </FormControl>
                      {index >= POLL_MIN_OPTIONS ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove answer ${index + 1}`}
                          onClick={() => pollOptions.remove(index)}
                          disabled={addQuack.isPending}
                        >
                          <X className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <div className="flex flex-wrap gap-2">
              {pollOptions.fields.length < POLL_MAX_OPTIONS ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => pollOptions.append({ text: "" })}
                  disabled={addQuack.isPending}
                >
                  <Plus className="size-4" />
                  Add answer
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => pollOptions.replace([])}
                disabled={addQuack.isPending}
              >
                Remove poll
              </Button>
            </div>
          </fieldset>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          {isPoll ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mr-auto"
              onClick={() => pollOptions.replace([{ text: "" }, { text: "" }])}
              disabled={addQuack.isPending}
            >
              Add poll
            </Button>
          )}
          <span
            className={cn(
              "text-sm",
              length > MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {length}/{MAX_LENGTH}
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={addQuack.isPending}
          >
            {addQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Quack
          </Button>
        </div>
      </form>
    </Form>
  )
}
