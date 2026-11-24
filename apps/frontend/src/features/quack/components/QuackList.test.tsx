// Example component test — the pattern to copy for your own components.
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { aQuack as quack } from "@/test/quacks"
import { renderWithRouter } from "@/test/renderWithRouter"

import { QuackList } from "@/features/quack/components/QuackList"

describe("QuackList", () => {
  it("renders quacks with author info", async () => {
    await renderWithRouter(<QuackList quacks={[quack()]} />)

    expect(screen.getByText("quack quack")).toBeInTheDocument()
    expect(screen.getByText("Caffeinated Duck")).toBeInTheDocument()
    expect(screen.getByText("@CaffeinatedDuck")).toBeInTheDocument()
  })

  it("shows the mood of a quack that has one", async () => {
    await renderWithRouter(<QuackList quacks={[quack({ mood: "silly" })]} />)

    expect(screen.getByText("Silly")).toBeInTheDocument()
  })

  it("shows no mood for a quack without one", async () => {
    await renderWithRouter(<QuackList quacks={[quack()]} />)

    for (const label of ["Happy", "Sad", "Angry", "Silly"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })

  it("says nothing matches a search, with a way to clear it", async () => {
    const onClearSearch = vi.fn()
    await renderWithRouter(
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

  it("keeps the original empty state when there is no search", async () => {
    await renderWithRouter(<QuackList quacks={[]} />)

    expect(screen.getByText("No quacks yet. Post the first one.")).toBeInTheDocument()
  })

  it("offers delete on the signed-in user's quacks only", async () => {
    await renderWithRouter(
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
      />,
    )

    const [mine, theirs] = screen.getAllByRole("article") as [HTMLElement, HTMLElement]
    expect(within(mine).getByRole("button", { name: "Delete quack" })).toBeInTheDocument()
    expect(within(theirs).queryByRole("button", { name: "Delete quack" })).not.toBeInTheDocument()
  })

  it("offers a moderator delete on everyone's quacks", async () => {
    await renderWithRouter(
      <QuackList
        currentUserId="u1"
        canModerate
        quacks={[
          quack(),
          quack({
            id: "q2",
            text: "not mine",
            userId: "u2",
            user: { id: "u2", name: "Bread Critic", username: "BreadCritic" },
          }),
        ]}
      />,
    )

    const [mine, theirs] = screen.getAllByRole("article") as [HTMLElement, HTMLElement]
    expect(within(mine).getByRole("button", { name: "Delete quack" })).toBeInTheDocument()
    expect(within(theirs).getByRole("button", { name: "Delete quack" })).toBeInTheDocument()
  })

  it("offers no delete without a signed-in user", async () => {
    await renderWithRouter(<QuackList quacks={[quack()]} />)

    expect(screen.queryByRole("button", { name: "Delete quack" })).not.toBeInTheDocument()
  })

  it("says when I have no quacks yet and offers to write the first", async () => {
    const onWriteFirst = vi.fn()
    await renderWithRouter(
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

  it("says nothing matches a search in my quacks too", async () => {
    await renderWithRouter(
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
    await renderWithRouter(
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
