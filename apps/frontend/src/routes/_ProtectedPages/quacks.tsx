import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"

import { profileQueryOptions } from "@/features/profile/api/profileQueryOptions"
import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { QuackForm } from "@/features/quack/components/QuackForm"
import { QuackList } from "@/features/quack/components/QuackList"

export const Route = createFileRoute("/_ProtectedPages/quacks")({
  // Loaded up front so the new-quack form starts with the preferred mood.
  // prefetchQuery never throws: without a profile the form just starts with no mood.
  loader: ({ context }) => context.queryClient.prefetchQuery(profileQueryOptions()),
  component: QuacksPage,
})

function QuacksPage() {
  const quacksQuery = useQuery(quacksQueryOptions())
  const profileQuery = useQuery(profileQueryOptions())

  return (
    <>
      <Seo title="Quacks" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quacks</h1>

        <QuackForm
          defaultMood={profileQuery.data?.defaultMood}
          className="mb-4"
        />

        <QuackList
          quacks={quacksQuery.data ?? []}
          isLoading={quacksQuery.isLoading}
          error={quacksQuery.error ?? undefined}
          // Only the error state offers a retry — posting invalidates the list,
          // and refocusing the tab refetches it.
          onReload={() => void quacksQuery.refetch()}
        />
      </section>
    </>
  )
}
