import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

// An empty search is the full feed; `isMine` limits it to the signed-in user's quacks.
export const quacksQueryOptions = (search = "", isMine = false) =>
  queryOptions({
    queryKey: quackKeys.list(search, isMine),
    queryFn: async () =>
      quacksSchema.parse(
        await api
          .get("quacks", {
            searchParams: { ...(search ? { q: search } : {}), ...(isMine ? { mine: true } : {}) },
          })
          .json(),
      ),
    // While a new search loads, keep showing the previous results instead of
    // blanking the feed on every pause in typing — but never carry quacks over
    // from the other tab, or "Mine" would briefly show everyone's.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2].isMine === isMine ? previous : undefined,
  })
