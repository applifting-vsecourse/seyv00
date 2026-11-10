import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { aDeletedQuack, aQuack, aReply } from "@/test/quacks"
import { renderWithRouter } from "@/test/renderWithRouter"

import { addReply } from "@/features/quack/api/addReply"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"
import { QuackThread } from "@/features/quack/components/QuackThread"

vi.mock("@/features/quack/api/addReply", () => ({ addReply: vi.fn() }))

// GET /quacks/:id, the whole thread
const fetchThread = vi.hoisted(() => vi.fn<() => Promise<Quack>>())
vi.mock("@/features/quack/api/threadQueryOptions", () => ({
  threadQueryOptions: (quackId: string) => ({
    queryKey: ["quacks", "thread", quackId],
    queryFn: fetchThread,
  }),
}))

const replies = [0, 1, 2, 3, 4].map((index) => aReply({ id: `r${index}`, text: `reply ${index}` }))

describe("QuackThread", () => {
  beforeEach(() => {
    vi.mocked(addReply).mockReset()
    fetchThread.mockReset()
  })

  it("shows replies under the quack", async () => {
    await renderWithRouter(<QuackThread quack={aQuack({ replyCount: 1, replies: [aReply()] })} />)

    const [quack, reply] = screen.getAllByRole("article") as [HTMLElement, HTMLElement]
    expect(within(quack).getByText("quack quack")).toBeInTheDocument()
    expect(within(reply).getByText("quack back")).toBeInTheDocument()
    expect(within(reply).getByText("@BreadCritic")).toBeInTheDocument()
  })

  it("shows a deleted quack as a placeholder, with its replies", async () => {
    await renderWithRouter(<QuackThread quack={aDeletedQuack([aReply()])} />)

    expect(screen.getByText("This message was deleted")).toBeInTheDocument()
    expect(screen.getByText("quack back")).toBeInTheDocument()
    expect(screen.queryByText("@CaffeinatedDuck")).not.toBeInTheDocument()
    // a placeholder can't be deleted, only replied to
    expect(screen.queryByRole("button", { name: "Delete quack" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reply to this thread" })).toBeInTheDocument()
  })

  it("loads the rest of the replies on request", async () => {
    fetchThread.mockResolvedValue(aQuack({ replyCount: 5, replies }))
    await renderWithRouter(
      <QuackThread quack={aQuack({ replyCount: 5, replies: replies.slice(0, 3) })} />,
    )

    expect(screen.queryByText("reply 3")).not.toBeInTheDocument()
    // nothing is loaded until asked for
    expect(fetchThread).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Show more replies (2)" }))

    expect(await screen.findByText("reply 4")).toBeInTheDocument()
    expect(screen.getByText("reply 3")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Show more replies/ })).not.toBeInTheDocument()
  })

  it("prefills @username when replying to a reply", async () => {
    await renderWithRouter(<QuackThread quack={aQuack({ replyCount: 1, replies: [aReply()] })} />)

    await userEvent.click(screen.getByRole("button", { name: "Reply to @BreadCritic" }))

    const text = screen.getByRole("textbox", { name: "Your reply" })
    expect(text).toHaveValue("@BreadCritic ")
    await waitFor(() => expect(text).toHaveFocus())
  })

  it("posts a reply to the thread, also when answering a reply, and closes the form", async () => {
    vi.mocked(addReply).mockResolvedValue(aReply({ id: "r9" }))
    await renderWithRouter(<QuackThread quack={aQuack({ replyCount: 1, replies: [aReply()] })} />)

    await userEvent.click(screen.getByRole("button", { name: "Reply to @BreadCritic" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Your reply" }), "agreed")
    await userEvent.click(screen.getByRole("button", { name: "Post reply" }))

    // one level deep: the reply goes to the top-level quack, not to the reply
    await waitFor(() =>
      expect(addReply).toHaveBeenCalledWith(
        { threadId: "q1", text: "@BreadCritic agreed", mood: null },
        expect.anything(),
      ),
    )
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Your reply" })).not.toBeInTheDocument(),
    )
  })

  it("refuses an empty reply without posting", async () => {
    await renderWithRouter(<QuackThread quack={aQuack()} />)

    await userEvent.click(screen.getByRole("button", { name: "Reply to @CaffeinatedDuck" }))
    await userEvent.click(screen.getByRole("button", { name: "Post reply" }))

    expect(await screen.findByText("Write something first")).toBeInTheDocument()
    expect(addReply).not.toHaveBeenCalled()
  })

  it("keeps the reply form open on the thread page", async () => {
    await renderWithRouter(
      <QuackThread
        quack={aQuack()}
        isFullThread
      />,
    )

    expect(screen.getByRole("textbox", { name: "Your reply" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument()
  })
})

describe("QuackList with replies listed on their own", () => {
  it("says which quack a reply answers, linking to its thread", async () => {
    await renderWithRouter(
      <QuackList quacks={[aQuack({ id: "r1", parentId: "q1", parent: aReply().parent })]} />,
    )

    expect(screen.getByRole("link", { name: "reply to @CaffeinatedDuck" })).toHaveAttribute(
      "href",
      "/quacks/q1",
    )
  })

  it("says when the quack it answered was deleted", async () => {
    await renderWithRouter(
      <QuackList
        quacks={[
          aQuack({
            id: "r1",
            parentId: "q1",
            parent: { id: "q1", isDeleted: true, username: null },
          }),
        ]}
      />,
    )

    expect(screen.getByRole("link", { name: "reply to a deleted message" })).toBeInTheDocument()
  })
})
