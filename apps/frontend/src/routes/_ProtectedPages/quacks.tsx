import { useCallback, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { Seo } from "@/components/Seo"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { useSession } from "@/features/auth/hooks/useSession"
import { profileQueryOptions } from "@/features/profile/api/profileQueryOptions"
import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { QuackForm, type QuackFormHandle } from "@/features/quack/components/QuackForm"
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
  // The "Mine" tab; absent means "All".
  mine: z.boolean().optional().catch(undefined),
})

export const Route = createFileRoute("/_ProtectedPages/quacks")({
  validateSearch: quacksSearchSchema,
  // Loaded up front so the new-quack form starts with the preferred mood.
  // prefetchQuery never throws: without a profile the form just starts with no mood.
  loader: ({ context }) => context.queryClient.prefetchQuery(profileQueryOptions()),
  component: QuacksPage,
})

function QuacksPage() {
  const { q: search = "", mine: isMine = false } = Route.useSearch()
  const navigate = Route.useNavigate()
  const quacksQuery = useQuery(quacksQueryOptions(search, isMine))
  const profileQuery = useQuery(profileQueryOptions())
  const { user } = useSession()
  const formRef = useRef<QuackFormHandle>(null)

  const setSearch = useCallback(
    (next: string) => {
      void navigate({
        search: (previous) => ({ ...previous, q: next || undefined }),
        // Starting a search adds a history entry, so Back returns to the full
        // feed; refining or clearing it replaces that entry instead of piling
        // one up per pause in typing.
        replace: search !== "",
        resetScroll: false,
      })
    },
    [navigate, search],
  )

  // Each tab is its own history entry, so Back returns to the other one.
  const setMine = (shouldShowMine: boolean) => {
    void navigate({
      search: (previous) => ({ ...previous, mine: shouldShowMine || undefined }),
      resetScroll: false,
    })
  }

  const tab = isMine ? "mine" : "all"

  return (
    <>
      <Seo title="Quacks" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quacks</h1>

        <QuackForm
          ref={formRef}
          defaultMood={profileQuery.data?.defaultMood}
          className="mb-6"
          // A new quack may not match the search, so show it in the full feed.
          // It's always the user's own, so the tab stays as it is.
          onPosted={() => setSearch("")}
        />

        <Tabs
          value={tab}
          onValueChange={(value) => setMine(value === "mine")}
          className="gap-4"
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="mine">Mine</TabsTrigger>
          </TabsList>

          {/* One panel for whichever tab is active: both show the same feed, filtered. */}
          <TabsContent
            value={tab}
            className="flex flex-col gap-4"
          >
            <QuackSearch
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
              currentUserId={user?.id}
              canModerate={user?.role === "admin"}
              isMine={isMine}
              onWriteFirst={() => formRef.current?.focus()}
            />
          </TabsContent>
        </Tabs>
      </section>
    </>
  )
}
