import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { Mood } from "@/lib/moods"

import { QuackForm } from "@/features/quack/components/QuackForm"

const renderForm = (defaultMood?: Mood | null) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuackForm defaultMood={defaultMood} />
    </QueryClientProvider>,
  )

describe("QuackForm", () => {
  it("starts with the user's default mood selected", () => {
    renderForm("silly")

    expect(screen.getByLabelText("Mood")).toHaveTextContent("Silly")
  })

  it("starts with no mood when the user has no default", () => {
    renderForm(null)

    expect(screen.getByLabelText("Mood")).toHaveTextContent("No mood")
  })
})
