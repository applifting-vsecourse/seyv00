import { z } from "zod"

import { moodSchema } from "@/lib/moods"

export const profileSchema = z.object({
  username: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  defaultMood: moodSchema.nullable(),
})

export type Profile = z.infer<typeof profileSchema>
