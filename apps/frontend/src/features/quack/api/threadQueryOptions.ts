import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quackSchema } from "@/features/quack/api/quackSchemas"

// A thread: the quack (or what's left of it) with all its replies, oldest first.
// A 404 means it's gone; the caller decides how to say so.
export const threadQueryOptions = (quackId: string) =>
  queryOptions({
    queryKey: quackKeys.thread(quackId),
    queryFn: async () => quackSchema.parse(await api.get(`quacks/${quackId}`).json()),
  })
