// Example component test — the pattern to copy for your own components.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

const quack = (overrides: Partial<Quack> = {}): Quack => ({
  id: "q1",
  text: "quack quack",
  mood: null,
  poll: null,
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  ...overrides,
})

describe("QuackList", () => {
  it("renders quacks with author info", () => {
    render(<QuackList quacks={[quack()]} />)

    expect(screen.getByText("quack quack")).toBeInTheDocument()
    expect(screen.getByText("Caffeinated Duck")).toBeInTheDocument()
    expect(screen.getByText("@CaffeinatedDuck")).toBeInTheDocument()
  })

  it("shows the mood of a quack that has one", () => {
    render(<QuackList quacks={[quack({ mood: "silly" })]} />)

    expect(screen.getByText("Silly")).toBeInTheDocument()
  })

  it("shows no mood for a quack without one", () => {
    render(<QuackList quacks={[quack()]} />)

    for (const label of ["Happy", "Sad", "Angry", "Silly"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })

  it("says nothing matches a search, with a way to clear it", async () => {
    const onClearSearch = vi.fn()
    render(
      <QuackList
        quacks={[]}
        search="zluva"
        onClearSearch={onClearSearch}
      />,
    )

    expect(screen.getByText("No quacks match “zluva”.")).toBeInTheDocument()
    expect(screen.queryByText("No quacks yet. Post the first one.")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect(onClearSearch).toHaveBeenCalledOnce()
  })

  it("keeps the original empty state when there is no search", () => {
    render(<QuackList quacks={[]} />)

    expect(screen.getByText("No quacks yet. Post the first one.")).toBeInTheDocument()
  })

  it("offers delete on the signed-in user's quacks only", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <QuackList
          currentUserId="u1"
          quacks={[
            quack(),
            quack({
              id: "q2",
              text: "not mine",
              userId: "u2",
              user: { id: "u2", name: "Bread Critic", username: "BreadCritic" },
            }),
          ]}
        />
      </QueryClientProvider>,
    )

    const [mine, theirs] = screen.getAllByRole("article") as [HTMLElement, HTMLElement]
    expect(within(mine).getByRole("button", { name: "Delete quack" })).toBeInTheDocument()
    expect(within(theirs).queryByRole("button", { name: "Delete quack" })).not.toBeInTheDocument()
  })

  it("offers no delete without a signed-in user", () => {
    render(<QuackList quacks={[quack()]} />)

    expect(screen.queryByRole("button", { name: "Delete quack" })).not.toBeInTheDocument()
  })

  it("says when I have no quacks yet and offers to write the first", async () => {
    const onWriteFirst = vi.fn()
    render(
      <QuackList
        quacks={[]}
        isMine
        onWriteFirst={onWriteFirst}
      />,
    )

    expect(screen.getByText("You haven't posted any quacks yet.")).toBeInTheDocument()
    expect(screen.queryByText("No quacks yet. Post the first one.")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Write your first quack" }))
    expect(onWriteFirst).toHaveBeenCalledOnce()
  })

  it("says nothing matches a search in my quacks too", () => {
    render(
      <QuackList
        quacks={[]}
        isMine
        search="zluva"
      />,
    )

    expect(screen.getByText("No quacks match “zluva”.")).toBeInTheDocument()
    expect(screen.queryByText("You haven't posted any quacks yet.")).not.toBeInTheDocument()
  })

  it("shows an error with a working reload button", async () => {
    const onReload = vi.fn()
    render(
      <QuackList
        quacks={[]}
        error={new Error("Server unreachable")}
        onReload={onReload}
      />,
    )

    expect(screen.getByText("Couldn't load quacks")).toBeInTheDocument()
    expect(screen.getByText("Server unreachable")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /reload/i }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})
