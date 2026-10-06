import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

// An empty search is the full feed.
export const quacksQueryOptions = (search = "") =>
  queryOptions({
    queryKey: quackKeys.list(search),
    queryFn: async () =>
      quacksSchema.parse(
        await api.get("quacks", { searchParams: search ? { q: search } : undefined }).json(),
      ),
    // While a new search loads, keep showing the previous results instead of
    // blanking the feed on every pause in typing.
    placeholderData: keepPreviousData,
  })
