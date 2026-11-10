import { QueryClient, useQuery } from "@tanstack/react-query"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { aQuack, aReply } from "@/test/quacks"
import { renderWithRouter } from "@/test/renderWithRouter"

import { deleteQuack } from "@/features/quack/api/deleteQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

vi.mock("@/features/quack/api/deleteQuack", () => ({ deleteQuack: vi.fn() }))

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

async function renderFeed(quacks: Quack[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData<Quack[]>(quackKeys.list(""), quacks)
  await renderWithRouter(<Feed />, queryClient)
}

describe("QuackDeleteButton", () => {
  beforeEach(() => {
    vi.mocked(deleteQuack).mockReset()
  })

  it("asks before deleting, and cancelling keeps the quack", async () => {
    await renderFeed([aQuack()])

    await userEvent.click(screen.getByRole("button", { name: "Delete quack" }))
    expect(screen.getByRole("alertdialog", { name: "Delete this quack?" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(deleteQuack).not.toHaveBeenCalled()
    expect(screen.getByText("quack quack")).toBeInTheDocument()
  })

  it("tells a moderator whose quack they are deleting", async () => {
    await renderWithRouter(
      <QuackList
        quacks={[
          aQuack({
            userId: "u2",
            user: { id: "u2", name: "Bread Critic", username: "BreadCritic" },
          }),
        ]}
        currentUserId="u1"
        canModerate
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "Delete quack" }))
    expect(
      screen.getByRole("alertdialog", { name: "Delete @BreadCritic's quack?" }),
    ).toHaveTextContent("You're removing it as a moderator.")
  })

  it("keeps the usual dialog for a moderator's own quack", async () => {
    await renderWithRouter(
      <QuackList
        quacks={[aQuack()]}
        currentUserId="u1"
        canModerate
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "Delete quack" }))
    expect(screen.getByRole("alertdialog", { name: "Delete this quack?" })).not.toHaveTextContent(
      "moderator",
    )
  })

  it("removes the quack from the feed once confirmed", async () => {
    vi.mocked(deleteQuack).mockResolvedValue()
    await renderFeed([aQuack(), aQuack({ id: "q2", text: "keep me" })])

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
    await renderFeed([aQuack()])

    await userEvent.click(screen.getByRole("button", { name: "Delete quack" }))
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))

    expect(await screen.findByText("Only the author can delete this quack")).toBeInTheDocument()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByText("quack quack")).toBeInTheDocument()
  })

  it("leaves a placeholder with the replies when the quack has some", async () => {
    vi.mocked(deleteQuack).mockResolvedValue()
    await renderFeed([aQuack({ replyCount: 1, replies: [aReply()] })])

    // the quack's own delete button, not the reply's
    const [quackDelete] = screen.getAllByRole("button", { name: "Delete quack" }) as [HTMLElement]
    await userEvent.click(quackDelete)
    expect(screen.getByRole("alertdialog")).toHaveTextContent("The replies stay")
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))

    expect(await screen.findByText("This message was deleted")).toBeInTheDocument()
    expect(screen.queryByText("quack quack")).not.toBeInTheDocument()
    expect(screen.getByText("quack back")).toBeInTheDocument()
  })
})
