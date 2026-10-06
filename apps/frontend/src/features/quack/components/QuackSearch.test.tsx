import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { QuackSearch } from "@/features/quack/components/QuackSearch"

describe("QuackSearch", () => {
  it("applies the typed search after a pause, without submitting", async () => {
    const onChange = vi.fn()
    render(
      <QuackSearch
        value=""
        onChange={onChange}
      />,
    )

    await userEvent.type(screen.getByLabelText("Search"), "  pants duck ")

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("pants duck"))
    // debounced: one call for the whole burst of typing, not one per key
    expect(onChange).toHaveBeenCalledOnce()
  })

  it("does not search for whitespace only", async () => {
    const onChange = vi.fn()
    render(
      <QuackSearch
        value=""
        onChange={onChange}
      />,
    )

    await userEvent.type(screen.getByLabelText("Search"), "   ")
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(onChange).not.toHaveBeenCalled()
  })

  it("shows a clear control only while there is text, and clearing resets the search", async () => {
    const onChange = vi.fn()
    render(
      <QuackSearch
        value="duck"
        onChange={onChange}
      />,
    )

    expect(screen.getByLabelText("Search")).toHaveValue("duck")
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }))

    expect(onChange).toHaveBeenCalledWith("")
    expect(screen.getByLabelText("Search")).toHaveValue("")
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument()
  })

  it("follows a search changed from outside, e.g. the Back button", () => {
    const { rerender } = render(
      <QuackSearch
        value="duck"
        onChange={vi.fn()}
      />,
    )

    rerender(
      <QuackSearch
        value=""
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByLabelText("Search")).toHaveValue("")
  })

  it("limits the search to 100 characters", () => {
    render(
      <QuackSearch
        value=""
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByLabelText("Search")).toHaveAttribute("maxLength", "100")
  })
})
