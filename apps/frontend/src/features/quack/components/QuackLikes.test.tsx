// Likes as the user sees them (cases.md, U1–U6).
import { useQuery, type QueryClient } from "@tanstack/react-query"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { HTTPError } from "@/lib/api-client"
import { aDeletedQuack, aQuack, aReply } from "@/test/quacks"
import { renderWithRouter } from "@/test/renderWithRouter"

import { likeQuack, unlikeQuack, type LikeState } from "@/features/quack/api/likeQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

vi.mock("@/features/quack/api/likeQuack", () => ({ likeQuack: vi.fn(), unlikeQuack: vi.fn() }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { toast } = await import("sonner")

// A quack as the API sends it once likes exist.
const withLikes = <T extends object>(quack: T, likeCount: number, isLikedByMe: boolean) => ({
  ...quack,
  likeCount,
  likedByMe: isLikedByMe,
})

// Renders the feed from the query cache, as the quacks page does, so a like
// shows up whether it's drawn from the cache or from the button's own state.
function Feed() {
  const { data } = useQuery<Quack[]>({
    queryKey: quackKeys.list(""),
    queryFn: () => Promise.reject(new Error("not used")),
    enabled: false,
  })
  return data ? (
    <QuackList
      quacks={data}
      currentUserId="u1"
    />
  ) : null
}

const renderFeed = async (quacks: Quack[]) => {
  const { queryClient } = await renderWithRouter(<Feed />)
  queryClient.setQueryData<Quack[]>(quackKeys.list(""), quacks)
  await screen.findAllByRole("article")
  return queryClient
}

const likeButton = (scope: HTMLElement = screen.getByRole("article")) =>
  within(scope).getByRole("button", { name: "Like" })
const unlikeButton = (scope: HTMLElement = screen.getByRole("article")) =>
  within(scope).getByRole("button", { name: "Unlike" })
// A bare number in the quack is its like count.
const countIn = (scope: HTMLElement = screen.getByRole("article")) =>
  within(scope).queryByText(/^\d+$/)

// a request that never answers
const never = () => new Promise<LikeState>(() => undefined)

const notFound = () =>
  new HTTPError(
    new Response(JSON.stringify({ message: "Quack not found" }), { status: 404 }),
    new Request("http://localhost/api/quacks/q1/like", { method: "PUT" }),
    {} as never,
  )

describe("Quack likes", () => {
  beforeEach(() => {
    vi.mocked(likeQuack).mockReset()
    vi.mocked(unlikeQuack).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it("U1: a quack nobody has liked has an empty heart and no number", async () => {
    await renderFeed([withLikes(aQuack(), 0, false)])

    expect(likeButton()).toHaveAttribute("aria-pressed", "false")
    expect(countIn()).not.toBeInTheDocument()
  })

  it("U2: a quack others have liked shows their count, heart still empty", async () => {
    await renderFeed([withLikes(aQuack(), 3, false)])

    expect(likeButton()).toHaveAttribute("aria-pressed", "false")
    expect(countIn()).toHaveTextContent("3")
  })

  it("U3: a quack I have liked has a filled, pressed Unlike button and its count", async () => {
    await renderFeed([withLikes(aQuack(), 1, true)])

    expect(unlikeButton()).toHaveAttribute("aria-pressed", "true")
    expect(countIn()).toHaveTextContent("1")
  })

  it("U4: a like shows straight away, before the server answers", async () => {
    vi.mocked(likeQuack).mockReturnValue(never())
    await renderFeed([withLikes(aQuack(), 0, false)])

    await userEvent.click(likeButton())

    expect(unlikeButton()).toHaveAttribute("aria-pressed", "true")
    expect(countIn()).toHaveTextContent("1")
    expect(likeQuack).toHaveBeenCalledWith("q1")
  })

  it("U4: taking a like back shows straight away too", async () => {
    vi.mocked(unlikeQuack).mockReturnValue(never())
    await renderFeed([withLikes(aQuack(), 1, true)])

    await userEvent.click(unlikeButton())

    expect(likeButton()).toHaveAttribute("aria-pressed", "false")
    expect(countIn()).not.toBeInTheDocument()
    expect(unlikeQuack).toHaveBeenCalledWith("q1")
  })

  it("U5: a refused like goes back, says why and reloads the feed", async () => {
    vi.mocked(likeQuack).mockRejectedValue(notFound())
    const queryClient: QueryClient = await renderFeed([withLikes(aQuack(), 0, false)])
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")

    await userEvent.click(likeButton())

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("This quack doesn't exist anymore"),
    )
    expect(likeButton()).toHaveAttribute("aria-pressed", "false")
    expect(countIn()).not.toBeInTheDocument()
    expect(invalidate).toHaveBeenCalled()
  })

  it("U6: a deleted message has no Like button and no count, its replies do", async () => {
    await renderFeed([aDeletedQuack([withLikes(aReply(), 2, false)])])

    const placeholder = screen.getByText("This message was deleted").closest("article")!
    const replyArticle = screen
      .getAllByRole("article")
      .find((article) => within(article).queryByText("quack back"))!

    // the reply's button is there, so the placeholder's absence means something
    expect(likeButton(replyArticle)).toBeInTheDocument()
    expect(countIn(replyArticle)).toHaveTextContent("2")
    expect(within(placeholder).queryByRole("button", { name: /like/i })).not.toBeInTheDocument()
    expect(countIn(placeholder)).not.toBeInTheDocument()
  })
})
