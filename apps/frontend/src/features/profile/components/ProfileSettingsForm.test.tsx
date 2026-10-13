import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { HTTPError } from "@/lib/api-client"

import type { Profile } from "@/features/profile/api/profileSchemas"
import { updateProfile } from "@/features/profile/api/updateProfile"
import { ProfileSettingsForm } from "@/features/profile/components/ProfileSettingsForm"

vi.mock("@/features/profile/api/updateProfile", () => ({ updateProfile: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const { toast } = await import("sonner")

const profile: Profile = {
  username: "CaffeinatedDuck",
  name: "Caffeinated Duck",
  bio: null,
  defaultMood: null,
}

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProfileSettingsForm profile={profile} />
    </QueryClientProvider>,
  )

const usernameTaken = () =>
  new HTTPError(
    new Response(JSON.stringify({ message: "Username is already taken" }), { status: 409 }),
    new Request("http://localhost/api/profile", { method: "PUT" }),
    {} as never,
  )

describe("ProfileSettingsForm", () => {
  beforeEach(() => {
    vi.mocked(updateProfile).mockReset()
    vi.mocked(toast.success).mockReset()
  })

  it("starts with the saved values", () => {
    renderForm()

    expect(screen.getByLabelText("Username")).toHaveValue("CaffeinatedDuck")
    expect(screen.getByLabelText("Display name")).toHaveValue("Caffeinated Duck")
    expect(screen.getByLabelText("Bio")).toHaveValue("")
  })

  it("saves the new username and confirms it", async () => {
    vi.mocked(updateProfile).mockImplementation((input) => Promise.resolve(input))
    renderForm()

    const username = screen.getByLabelText("Username")
    await userEvent.clear(username)
    await userEvent.type(username, "decaf.duck")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(vi.mocked(updateProfile).mock.calls[0]?.[0]).toEqual({
      ...profile,
      username: "decaf.duck",
    })
    expect(toast.success).toHaveBeenCalledWith("Settings saved")
    expect(username).toHaveValue("decaf.duck")
  })

  it.each([
    ["du", "Use at least 3 characters"],
    ["a".repeat(31), "Use at most 30 characters"],
    ["duck!", "Use only letters, numbers, dots and underscores"],
  ])("rejects the username %j before sending it", async (value, message) => {
    renderForm()

    const username = screen.getByLabelText("Username")
    await userEvent.clear(username)
    await userEvent.type(username, value)
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it("says a taken username is taken at the field and keeps what was typed", async () => {
    vi.mocked(updateProfile).mockRejectedValue(usernameTaken())
    renderForm()

    const username = screen.getByLabelText("Username")
    await userEvent.clear(username)
    await userEvent.type(username, "DeepDuckThoughts")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("That username is already taken")).toBeInTheDocument()
    expect(username).toHaveValue("DeepDuckThoughts")
    expect(username).toHaveAttribute("aria-invalid", "true")
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("requires a display name and limits the bio", async () => {
    renderForm()

    await userEvent.clear(screen.getByLabelText("Display name"))
    await userEvent.type(screen.getByLabelText("Bio"), "q".repeat(161))
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Display name is required")).toBeInTheDocument()
    expect(screen.getByText("Keep it under 160 characters")).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it("discards unsaved changes back to the saved values", async () => {
    renderForm()

    await userEvent.type(screen.getByLabelText("Username"), "_v2")
    await userEvent.type(screen.getByLabelText("Bio"), "Off coffee")
    await userEvent.click(screen.getByRole("button", { name: "Discard changes" }))

    expect(screen.getByLabelText("Username")).toHaveValue("CaffeinatedDuck")
    expect(screen.getByLabelText("Bio")).toHaveValue("")
    expect(updateProfile).not.toHaveBeenCalled()
  })
})
