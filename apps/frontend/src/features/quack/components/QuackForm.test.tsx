import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Mood } from "@/lib/moods"

import { addQuack } from "@/features/quack/api/addQuack"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackForm } from "@/features/quack/components/QuackForm"

vi.mock("@/features/quack/api/addQuack", () => ({ addQuack: vi.fn() }))

const renderForm = (defaultMood?: Mood | null) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuackForm defaultMood={defaultMood} />
    </QueryClientProvider>,
  )

const button = (name: string) => screen.getByRole("button", { name })
const answerField = (n: number) => screen.getByLabelText(`Answer ${n}`)

describe("QuackForm", () => {
  beforeEach(() => {
    vi.mocked(addQuack).mockReset()
    vi.mocked(addQuack).mockResolvedValue({} as Quack)
  })

  it("starts with the user's default mood selected", () => {
    renderForm("silly")

    expect(screen.getByLabelText("Mood")).toHaveTextContent("Silly")
  })

  it("starts with no mood when the user has no default", () => {
    renderForm(null)

    expect(screen.getByLabelText("Mood")).toHaveTextContent("No mood")
  })

  it("posts an ordinary quack without a poll", async () => {
    renderForm()

    await userEvent.type(screen.getByLabelText("New quack"), "hello")
    await userEvent.click(button("Quack"))

    await waitFor(() => expect(addQuack).toHaveBeenCalled())
    expect(vi.mocked(addQuack).mock.calls[0]?.[0]).toEqual({
      text: "hello",
      mood: null,
      poll: null,
    })
  })

  it("adds a poll with two answers, up to four, and removes extra ones", async () => {
    renderForm()

    await userEvent.click(button("Add poll"))
    expect(answerField(1)).toBeInTheDocument()
    expect(answerField(2)).toBeInTheDocument()
    // the first two can't be removed: a poll needs at least two answers
    expect(screen.queryByRole("button", { name: /Remove answer/ })).not.toBeInTheDocument()

    await userEvent.click(button("Add answer"))
    await userEvent.click(button("Add answer"))
    expect(answerField(4)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add answer" })).not.toBeInTheDocument()

    await userEvent.click(button("Remove answer 3"))
    expect(screen.queryByLabelText("Answer 4")).not.toBeInTheDocument()
    expect(button("Add answer")).toBeInTheDocument()
  })

  it("posts the question with its trimmed answers, then resets to an ordinary quack", async () => {
    renderForm("happy")

    await userEvent.type(screen.getByLabelText("New quack"), "Lunch?")
    await userEvent.click(button("Add poll"))
    await userEvent.type(answerField(1), "  Pizza ")
    await userEvent.type(answerField(2), "Thai")
    await userEvent.click(button("Quack"))

    await waitFor(() => expect(addQuack).toHaveBeenCalled())
    expect(vi.mocked(addQuack).mock.calls[0]?.[0]).toEqual({
      text: "Lunch?",
      mood: "happy",
      poll: { options: ["Pizza", "Thai"] },
    })
    await waitFor(() => expect(screen.queryByLabelText("Answer 1")).not.toBeInTheDocument())
    expect(button("Add poll")).toBeInTheDocument()
  })

  it("removing the poll leaves an ordinary quack", async () => {
    renderForm()

    await userEvent.type(screen.getByLabelText("New quack"), "never mind")
    await userEvent.click(button("Add poll"))
    await userEvent.click(button("Remove poll"))
    await userEvent.click(button("Quack"))

    await waitFor(() => expect(addQuack).toHaveBeenCalled())
    expect(vi.mocked(addQuack).mock.calls[0]?.[0]).toMatchObject({ poll: null })
  })

  it.each([
    ["an empty answer", "Pizza", "   ", "Write an answer"],
    ["an answer over 50 characters", "Pizza", "x".repeat(51), "Keep it under 50 characters"],
    ["the same answer twice", "Pizza", " pizza", "Answers must be different"],
  ])("rejects %s under the field and posts nothing", async (_, first, second, message) => {
    renderForm()

    await userEvent.type(screen.getByLabelText("New quack"), "Lunch?")
    await userEvent.click(button("Add poll"))
    await userEvent.type(answerField(1), first)
    await userEvent.type(answerField(2), second)
    await userEvent.click(button("Quack"))

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(answerField(2)).toHaveAttribute("aria-invalid", "true")
    expect(addQuack).not.toHaveBeenCalled()
  })

  it("counts an emoji answer as one character per emoji", async () => {
    renderForm()

    await userEvent.type(screen.getByLabelText("New quack"), "Lunch?")
    await userEvent.click(button("Add poll"))
    await userEvent.type(answerField(1), "🍕".repeat(50))
    await userEvent.type(answerField(2), "Thai")
    await userEvent.click(button("Quack"))

    await waitFor(() => expect(addQuack).toHaveBeenCalled())
  })
})
