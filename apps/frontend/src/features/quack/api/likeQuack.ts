import type { z } from "zod"

import { api } from "@/lib/api-client"

import { likeStateSchema } from "@/features/quack/api/quackSchemas"

// A quack's likes after a like or unlike, seen by the one who sent it.
export type LikeState = z.infer<typeof likeStateSchema>

// Liking again changes nothing; the response is the quack's fresh likes.
export async function likeQuack(quackId: string): Promise<LikeState> {
  const json = await api.put(`quacks/${quackId}/like`).json()
  return likeStateSchema.parse(json)
}

// Taking back a like that isn't there is fine too.
export async function unlikeQuack(quackId: string): Promise<LikeState> {
  const json = await api.delete(`quacks/${quackId}/like`).json()
  return likeStateSchema.parse(json)
}
