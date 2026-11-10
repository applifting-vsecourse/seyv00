import { api } from "@/lib/api-client"
import type { Mood } from "@/lib/moods"

import { liveQuackSchema, type Reply } from "@/features/quack/api/quackSchemas"

// `threadId` is the top-level quack: replies are one level deep, so replying
// to a reply means replying to its thread.
export async function addReply(input: {
  threadId: string
  text: string
  mood: Mood | null
}): Promise<Reply> {
  const json = await api
    .post(`quacks/${input.threadId}/replies`, { json: { text: input.text, mood: input.mood } })
    .json()
  return liveQuackSchema.parse(json)
}
