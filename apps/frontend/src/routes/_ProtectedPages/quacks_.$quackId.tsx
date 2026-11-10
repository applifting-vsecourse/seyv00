import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react"

import { ROUTES } from "@/app/routes"
import { Seo } from "@/components/Seo"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { HTTPError } from "@/lib/api-client"

import { useSession } from "@/features/auth/hooks/useSession"
import { profileQueryOptions } from "@/features/profile/api/profileQueryOptions"
import { threadQueryOptions } from "@/features/quack/api/threadQueryOptions"
import { QuackThread } from "@/features/quack/components/QuackThread"

// `quacks_` keeps the thread page out of the feed's layout: it's a page of its own.
export const Route = createFileRoute("/_ProtectedPages/quacks_/$quackId")({
  // The reply form starts with the preferred mood; without a profile it starts with none.
  loader: ({ context }) => context.queryClient.prefetchQuery(profileQueryOptions()),
  component: ThreadPage,
})

function ThreadPage() {
  const { quackId } = Route.useParams()
  const threadQuery = useQuery(threadQueryOptions(quackId))
  const profileQuery = useQuery(profileQueryOptions())
  const { user } = useSession()

  const isGone = threadQuery.error instanceof HTTPError && threadQuery.error.response.status === 404

  return (
    <>
      <Seo title="Thread" />
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-3 text-muted-foreground"
          >
            <Link to={ROUTES.quacks}>
              <ArrowLeft className="size-4" />
              Back to quacks
            </Link>
          </Button>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Thread</h1>

        {threadQuery.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : null}

        {isGone ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            This thread doesn&apos;t exist anymore.
          </p>
        ) : null}

        {threadQuery.error && !isGone ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t load the thread</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{threadQuery.error.message}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void threadQuery.refetch()}
              >
                <RefreshCw className="size-4" />
                Reload
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {threadQuery.data && !threadQuery.error ? (
          <QuackThread
            // a fresh form when moving to another thread
            key={threadQuery.data.id}
            quack={threadQuery.data}
            currentUserId={user?.id}
            canModerate={user?.role === "admin"}
            defaultMood={profileQuery.data?.defaultMood}
            isFullThread
          />
        ) : null}
      </section>
    </>
  )
}
