import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { Seo } from "@/components/Seo"

import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { QuackForm } from "@/features/quack/components/QuackForm"
import { QuackList } from "@/features/quack/components/QuackList"
import { QuackSearch, SEARCH_MAX_LENGTH } from "@/features/quack/components/QuackSearch"

// The search lives in the URL so it survives a reload and can be shared.
// The router parses `?q=123` as a number, hence the coercion; a hand-edited
// overlong term is cut to what the box itself would accept.
const quacksSearchSchema = z.object({
  q: z.coerce
    .string()
    .transform((q) => q.trim().slice(0, SEARCH_MAX_LENGTH))
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute("/_ProtectedPages/quacks")({
  component: QuacksPage,
  validateSearch: quacksSearchSchema,
})

function QuacksPage() {
  const { q: search = "" } = Route.useSearch()
  const navigate = Route.useNavigate()
  const quacksQuery = useQuery(quacksQueryOptions(search))

  const setSearch = useCallback(
    (next: string) => {
      void navigate({
        search: next ? { q: next } : {},
        // Starting a search adds a history entry, so Back returns to the full
        // feed; refining or clearing it replaces that entry instead of piling
        // one up per pause in typing.
        replace: search !== "",
        resetScroll: false,
      })
    },
    [navigate, search],
  )

  return (
    <>
      <Seo title="Quacks" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quacks</h1>

        <QuackForm
          className="mb-6"
          // A new quack may not match the search, so show it in the full feed.
          onPosted={() => setSearch("")}
        />

        <QuackSearch
          className="mb-4"
          value={search}
          onChange={setSearch}
        />

        <QuackList
          quacks={quacksQuery.data ?? []}
          isLoading={quacksQuery.isLoading || quacksQuery.isPlaceholderData}
          error={quacksQuery.error ?? undefined}
          // Only the error state offers a retry — posting invalidates the list,
          // and refocusing the tab refetches it.
          onReload={() => void quacksQuery.refetch()}
          search={search}
          onClearSearch={() => setSearch("")}
        />
      </section>
    </>
  )
}
