import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll, Quack } from "@/features/quack/api/quackSchemas"
import { votePoll } from "@/features/quack/api/votePoll"
import { QuackPoll } from "@/features/quack/components/QuackPoll"
import { applyVote } from "@/features/quack/hooks/useVote"

vi.mock("@/features/quack/api/votePoll", () => ({ votePoll: vi.fn() }))

const aPoll = (overrides: Partial<Poll> = {}): Poll => ({
  options: [
    { id: "pizza", text: "Pizza", votes: 3 },
    { id: "thai", text: "Thai", votes: 1 },
    { id: "salad", text: "Salad", votes: 0 },
  ],
  totalVotes: 4,
  myOptionId: null,
  isAuthor: false,
  ...overrides,
})

const aQuack = (poll: Poll): Quack => ({
  id: "q1",
  text: "Lunch?",
  mood: null,
  userId: "author",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "author", name: "Bread Critic", username: "BreadCritic" },
  poll,
})

// Renders the poll from the feed cache, as QuackList does, so a successful
// vote's server response shows up the same way it does in the app.
function FeedPoll() {
  const { data } = useQuery<Quack[]>({
    queryKey: quackKeys.list(""),
    queryFn: () => Promise.reject(new Error("not used")),
    enabled: false,
  })
  const quack = data?.[0]
  return quack?.poll ? (
    <QuackPoll
      quackId={quack.id}
      poll={quack.poll}
    />
  ) : null
}

const renderPoll = (poll: Poll) => {
  const queryClient = new QueryClient()
  queryClient.setQueryData<Quack[]>(quackKeys.list(""), [aQuack(poll)])
  render(
    <QueryClientProvider client={queryClient}>
      <FeedPoll />
    </QueryClientProvider>,
  )
}

const answer = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) })

// A request the test resolves or rejects when it wants to.
const deferred = () => {
  let resolve!: (poll: Poll) => void
  let reject!: (error: Error) => void
  const promise = new Promise<Poll>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("QuackPoll", () => {
  beforeEach(() => {
    vi.mocked(votePoll).mockReset()
  })

  it("hides per-answer counts until you vote, but shows the total", () => {
    renderPoll(aPoll())

    expect(answer("Pizza")).toHaveAttribute("aria-pressed", "false")
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    expect(screen.getByText("4 votes")).toBeInTheDocument()
  })

  it("shows counts, percentages and your choice once you've voted", () => {
    renderPoll(aPoll({ myOptionId: "thai" }))

    expect(answer("Thai")).toHaveAttribute("aria-pressed", "true")
    expect(within(answer("Pizza")).getByText("75% · 3")).toBeInTheDocument()
    expect(within(answer("Thai")).getByText("25% · 1")).toBeInTheDocument()
    expect(within(answer("Salad")).getByText("0% · 0")).toBeInTheDocument()
  })

  it("always shows the author the counts", () => {
    renderPoll(aPoll({ isAuthor: true }))

    expect(within(answer("Pizza")).getByText("75% · 3")).toBeInTheDocument()
  })

  it.each([
    [0, "No votes yet"],
    [1, "1 vote"],
    [2, "2 votes"],
  ])("says %i votes as %j", (total, text) => {
    renderPoll(aPoll({ totalVotes: total }))

    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it("shows a vote instantly, before the server answers", async () => {
    const request = deferred()
    vi.mocked(votePoll).mockReturnValue(request.promise)
    renderPoll(aPoll())

    await userEvent.click(answer("Thai"))

    expect(votePoll).toHaveBeenCalledWith("q1", "thai")
    expect(answer("Thai")).toHaveAttribute("aria-pressed", "true")
    expect(within(answer("Thai")).getByText("40% · 2")).toBeInTheDocument()
    expect(screen.getByText("5 votes")).toBeInTheDocument()

    // the server's counts win once they arrive, including other people's votes
    act(() =>
      request.resolve(
        aPoll({
          myOptionId: "thai",
          totalVotes: 6,
          options: [
            { id: "pizza", text: "Pizza", votes: 4 },
            { id: "thai", text: "Thai", votes: 2 },
            { id: "salad", text: "Salad", votes: 0 },
          ],
        }),
      ),
    )
    expect(await screen.findByText("6 votes")).toBeInTheDocument()
    expect(within(answer("Thai")).getByText("33% · 2")).toBeInTheDocument()
  })

  it("goes back to how it was and says so when a vote fails", async () => {
    vi.mocked(votePoll).mockRejectedValue(new Error("Network down"))
    renderPoll(aPoll({ myOptionId: "pizza" }))

    await userEvent.click(answer("Thai"))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your vote didn't go through. Try again.",
    )
    expect(answer("Pizza")).toHaveAttribute("aria-pressed", "true")
    expect(answer("Thai")).toHaveAttribute("aria-pressed", "false")
    expect(within(answer("Pizza")).getByText("75% · 3")).toBeInTheDocument()
  })

  it("clears the failure message when the next vote succeeds", async () => {
    vi.mocked(votePoll)
      .mockRejectedValueOnce(new Error("Network down"))
      .mockResolvedValueOnce(applyVote(aPoll(), "salad"))
    renderPoll(aPoll())

    await userEvent.click(answer("Thai"))
    await screen.findByRole("alert")
    await userEvent.click(answer("Salad"))

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
    expect(answer("Salad")).toHaveAttribute("aria-pressed", "true")
  })

  it("does nothing when you click the answer you already chose", async () => {
    renderPoll(aPoll({ myOptionId: "pizza" }))

    await userEvent.click(answer("Pizza"))

    expect(votePoll).not.toHaveBeenCalled()
  })

  it("sends rapid clicks one at a time, and the last click wins", async () => {
    const [first, second, third] = [deferred(), deferred(), deferred()]
    vi.mocked(votePoll)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise)
    renderPoll(aPoll())

    await userEvent.click(answer("Thai"))
    await userEvent.click(answer("Salad"))
    await userEvent.click(answer("Pizza"))

    // shown at once, but only the first request has gone out
    expect(answer("Pizza")).toHaveAttribute("aria-pressed", "true")
    expect(votePoll).toHaveBeenCalledTimes(1)

    act(() => first.resolve(applyVote(aPoll(), "thai")))
    await waitFor(() => expect(votePoll).toHaveBeenCalledTimes(2))
    // a failing click in the middle doesn't undo the later one
    act(() => second.reject(new Error("Network down")))
    await waitFor(() => expect(votePoll).toHaveBeenCalledTimes(3))
    expect(answer("Pizza")).toHaveAttribute("aria-pressed", "true")

    act(() => third.resolve(applyVote(applyVote(aPoll(), "thai"), "pizza")))

    expect(vi.mocked(votePoll).mock.calls.map(([, optionId]) => optionId)).toEqual([
      "thai",
      "salad",
      "pizza",
    ])
    await waitFor(() => expect(answer("Pizza")).toHaveAttribute("aria-pressed", "true"))
    expect(await screen.findByText("5 votes")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})

describe("applyVote", () => {
  it("moves a vote without changing the total", () => {
    const moved = applyVote(aPoll({ myOptionId: "pizza" }), "salad")

    expect(moved.options.map((option) => option.votes)).toEqual([2, 1, 1])
    expect(moved.totalVotes).toBe(4)
  })

  it("adds a first vote to the total", () => {
    expect(applyVote(aPoll(), "salad").totalVotes).toBe(5)
  })
})
