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

// What a reply answers, for its "↳ reply to @username" header.
export const replyParentSchema = z.object({
  id: z.string(),
  isDeleted: z.boolean(),
  // null when the parent was deleted
  username: z.string().nullable(),
})

const threadFields = {
  id: z.string(),
  createdAt: z.coerce.date(),
  // set on a reply; replies are one level deep
  parentId: z.string().nullable(),
  parent: replyParentSchema.nullable(),
  replyCount: z.number().int().nonnegative(),
}

// A quack someone wrote. Replies are always this kind: a reply is deleted for
// good, never turned into a placeholder.
export const liveQuackSchema = z.object({
  ...threadFields,
  isDeleted: z.literal(false),
  text: z.string(),
  mood: moodSchema.nullable(),
  userId: z.string(),
  user: quackUserSchema,
  poll: pollSchema.nullable(),
})

// A deleted quack kept only because it has replies: its content and author are gone.
export const deletedQuackSchema = z.object({
  ...threadFields,
  isDeleted: z.literal(true),
})

// Oldest first: the first few in a list, all of them in a thread, none on a reply.
const replies = z.array(liveQuackSchema)

export const quackSchema = z.discriminatedUnion("isDeleted", [
  liveQuackSchema.extend({ replies }),
  deletedQuackSchema.extend({ replies }),
])

export const quacksSchema = z.array(quackSchema)

export type Quack = z.infer<typeof quackSchema>
export type LiveQuack = Extract<Quack, { isDeleted: false }>
export type Reply = z.infer<typeof liveQuackSchema>
export type Poll = z.infer<typeof pollSchema>
