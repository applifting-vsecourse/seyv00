import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { MoodSelect } from "@/components/MoodSelect"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { HTTPError } from "@/lib/api-client"
import { moodSchema } from "@/lib/moods"
import { cn } from "@/lib/utils"

import type { Profile } from "@/features/profile/api/profileSchemas"
import { useUpdateProfile } from "@/features/profile/hooks/useUpdateProfile"

// Mirror the server-side DTO so the user is told before the request is made —
// the server still validates independently.
const USERNAME_MIN_LENGTH = 3
const USERNAME_MAX_LENGTH = 30
const BIO_MAX_LENGTH = 160

const USERNAME_TAKEN_MESSAGE = "That username is already taken"

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN_LENGTH, `Use at least ${USERNAME_MIN_LENGTH} characters`)
    .max(USERNAME_MAX_LENGTH, `Use at most ${USERNAME_MAX_LENGTH} characters`)
    .regex(/^[a-zA-Z0-9_.]+$/, "Use only letters, numbers, dots and underscores"),
  name: z.string().trim().min(1, "Display name is required"),
  bio: z.string().trim().max(BIO_MAX_LENGTH, `Keep it under ${BIO_MAX_LENGTH} characters`),
  defaultMood: moodSchema.nullable(),
})

type FormValues = z.infer<typeof schema>

const toFormValues = (profile: Profile): FormValues => ({
  username: profile.username,
  name: profile.name,
  bio: profile.bio ?? "",
  defaultMood: profile.defaultMood,
})

type ProfileSettingsFormProps = { profile: Profile }

export function ProfileSettingsForm({ profile }: ProfileSettingsFormProps) {
  const updateProfile = useUpdateProfile()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(profile),
  })

  const bio = useWatch({ control: form.control, name: "bio" })
  const bioLength = bio?.length ?? 0

  const handleSubmit = (values: FormValues) => {
    updateProfile.mutate(
      { ...values, bio: values.bio || null },
      {
        onSuccess: (saved) => {
          // what's saved becomes the new baseline that "Discard" returns to
          form.reset(toFormValues(saved))
          toast.success("Settings saved")
        },
        onError: (error) => {
          // keep what the user typed and say what's wrong right at the field
          if (error instanceof HTTPError && error.response.status === 409) {
            form.setError("username", { message: USERNAME_TAKEN_MESSAGE }, { shouldFocus: true })
          }
        },
      },
    )
  }

  const handleDiscard = () => {
    form.reset()
    updateProfile.reset()
  }

  const isUsernameTaken =
    updateProfile.error instanceof HTTPError && updateProfile.error.response.status === 409

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-8"
      >
        {updateProfile.error && !isUsernameTaken ? (
          <Alert variant="destructive">
            <AlertDescription>{updateProfile.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <section
          aria-labelledby="profile-heading"
          className="flex flex-col gap-6"
        >
          <h2
            id="profile-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Profile
          </h2>

          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="username"
                    disabled={updateProfile.isPending}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  People find you as @username. {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH}{" "}
                  characters: letters, numbers, dots and underscores.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display name</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="name"
                    disabled={updateProfile.isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="e.g. Professional bread critic"
                    disabled={updateProfile.isPending}
                    {...field}
                  />
                </FormControl>
                <div className="flex items-start justify-between gap-3">
                  <FormMessage />
                  <span
                    className={cn(
                      "ml-auto text-sm",
                      bioLength > BIO_MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {bioLength}/{BIO_MAX_LENGTH}
                  </span>
                </div>
              </FormItem>
            )}
          />
        </section>

        <Separator />

        <section
          aria-labelledby="posting-heading"
          className="flex flex-col gap-6"
        >
          <h2
            id="posting-heading"
            className="text-lg font-semibold tracking-tight"
          >
            New quacks
          </h2>

          <FormField
            control={form.control}
            name="defaultMood"
            render={({ field }) => (
              <FormItem className="sm:w-60">
                <FormLabel>Default mood</FormLabel>
                <MoodSelect
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  isDisabled={updateProfile.isPending}
                />
                <FormDescription>Preselected whenever you write a new quack.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={updateProfile.isPending || !form.formState.isDirty}
          >
            Discard changes
          </Button>
          <Button
            type="submit"
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </form>
    </Form>
  )
}
