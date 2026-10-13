import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"

import { profileQueryOptions } from "@/features/profile/api/profileQueryOptions"
import { ProfileSettingsForm } from "@/features/profile/components/ProfileSettingsForm"

export const Route = createFileRoute("/_ProtectedPages/settings")({
  // The form starts from the saved values, so it can't render without them.
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQueryOptions()),
  component: SettingsPage,
})

function SettingsPage() {
  const { data: profile } = useSuspenseQuery(profileQueryOptions())

  return (
    <>
      <Seo title="Settings" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>
        <ProfileSettingsForm profile={profile} />
      </section>
    </>
  )
}
