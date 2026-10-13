import { z } from "zod"

import { moodSchema } from "@/lib/moods"

// Per the Applifting frontend playbook: validate every server payload with zod
// and infer types from the schema rather than auto-generating them.
export const quackUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
})

export const pollOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  // Always sent; the UI hides it until the viewer has voted or wrote the poll.
  votes: z.number().int().nonnegative(),
})

export const pollSchema = z.object({
  options: z.array(pollOptionSchema),
  totalVotes: z.number().int().nonnegative(),
  myOptionId: z.string().nullable(),
  isAuthor: z.boolean(),
})

export const quackSchema = z.object({
  id: z.string(),
  text: z.string(),
  mood: moodSchema.nullable(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
  poll: pollSchema.nullable(),
})

export const quacksSchema = z.array(quackSchema)

export type Quack = z.infer<typeof quackSchema>
export type Poll = z.infer<typeof pollSchema>
