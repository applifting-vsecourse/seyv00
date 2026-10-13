import { api } from "@/lib/api-client"

import { pollSchema, type Poll } from "@/features/quack/api/quackSchemas"

// Casts the vote or moves it; the response is the poll's fresh state.
export async function votePoll(quackId: string, optionId: string): Promise<Poll> {
  const json = await api.put(`quacks/${quackId}/vote`, { json: { optionId } }).json()
  return pollSchema.parse(json)
}
