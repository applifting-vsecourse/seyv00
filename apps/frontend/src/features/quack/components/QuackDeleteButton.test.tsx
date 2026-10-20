import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { deleteQuack } from "@/features/quack/api/deleteQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

vi.mock("@/features/quack/api/deleteQuack", () => ({ deleteQuack: vi.fn() }))

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: "q1",
  text: "quack quack",
  mood: null,
  poll: null,
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  ...overrides,
})

// Renders the feed from the cache, as the page does, so a deleted quack
// disappears the same way it does in the app.
function Feed() {
  const { data } = useQuery<Quack[]>({
    queryKey: quackKeys.list(""),
    queryFn: () => Promise.reject(new Error("not used")),
  })
  return (
    <QuackList
      quacks={data ?? []}
      currentUserId="u1"
    />
  )
}

function renderFeed(quacks: Quack[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData<Quack[]>(quackKeys.list(""), quacks)
  render(
    <QueryClientProvider client={queryClient}>
      <Feed />
    </QueryClientProvider>,
  )
}

describe("QuackDeleteButton", () => {
  beforeEach(() => {
    vi.mocked(deleteQuack).mockReset()
  })

  it("asks before deleting, and cancelling keeps the quack", async () => {
    renderFeed([aQuack()])

    await userEvent.click(screen.getByRole("button", { name: "Delete quack" }))
    expect(screen.getByRole("alertdialog", { name: "Delete this quack?" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(deleteQuack).not.toHaveBeenCalled()
    expect(screen.getByText("quack quack")).toBeInTheDocument()
  })

  it("removes the quack from the feed once confirmed", async () => {
    vi.mocked(deleteQuack).mockResolvedValue()
    renderFeed([aQuack(), aQuack({ id: "q2", text: "keep me" })])

    const [firstDelete] = screen.getAllByRole("button", { name: "Delete quack" }) as [HTMLElement]
    await userEvent.click(firstDelete)
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))

    expect(deleteQuack).toHaveBeenCalledWith("q1", expect.anything())
    await waitFor(() => expect(screen.queryByText("quack quack")).not.toBeInTheDocument())
    expect(screen.getByText("keep me")).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("keeps the dialog open with the reason when deleting fails", async () => {
    vi.mocked(deleteQuack).mockRejectedValue(new Error("Only the author can delete this quack"))
    renderFeed([aQuack()])

    await userEvent.click(screen.getByRole("button", { name: "Delete quack" }))
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))

    expect(await screen.findByText("Only the author can delete this quack")).toBeInTheDocument()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByText("quack quack")).toBeInTheDocument()
  })
})
