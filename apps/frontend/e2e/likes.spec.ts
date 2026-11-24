import { expect, test, type Page } from "@playwright/test"

import { signIn } from "./signIn"

// Likes end to end (cases.md, E1–E3).

const API = "http://localhost:4050/api"

async function postQuack(page: Page, text: string) {
  await page.goto("/quacks")
  await page.getByLabel("New quack").fill(text)
  await page.getByRole("button", { name: "Quack", exact: true }).click()
  const quack = page.getByRole("article").filter({ hasText: text })
  await expect(quack).toBeVisible()
  return quack
}

test("E1: like a quack and take the like back, and both survive a reload", async ({ page }) => {
  const text = `E2E like ${Date.now()}`
  await signIn(page, "caffeinatedduck@example.com", "password1")
  let quack = await postQuack(page, text)

  // nobody has liked it: an empty heart, no number
  await expect(quack.getByRole("button", { name: "Like" })).toHaveAttribute("aria-pressed", "false")
  await expect(quack.getByText("1", { exact: true })).toHaveCount(0)

  await quack.getByRole("button", { name: "Like" }).click()
  await expect(quack.getByRole("button", { name: "Unlike" })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect(quack.getByText("1", { exact: true })).toBeVisible()

  // the server kept it
  await page.reload()
  quack = page.getByRole("article").filter({ hasText: text })
  await expect(quack.getByRole("button", { name: "Unlike" })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect(quack.getByText("1", { exact: true })).toBeVisible()

  await quack.getByRole("button", { name: "Unlike" }).click()
  await expect(quack.getByRole("button", { name: "Like" })).toHaveAttribute("aria-pressed", "false")
  await expect(quack.getByText("1", { exact: true })).toHaveCount(0)

  // and the server forgot it
  await page.reload()
  quack = page.getByRole("article").filter({ hasText: text })
  await expect(quack.getByRole("button", { name: "Like" })).toHaveAttribute("aria-pressed", "false")
  await expect(quack.getByText("1", { exact: true })).toHaveCount(0)
})

test("E2: someone else sees the count, but not as their own like", async ({ page, browser }) => {
  const text = `E2E liked by another ${Date.now()}`
  await signIn(page, "caffeinatedduck@example.com", "password1")
  const quack = await postQuack(page, text)
  await expect(quack.getByRole("button", { name: "Like" })).toBeVisible()
  await quack.getByRole("button", { name: "Like" }).click()
  await expect(quack.getByRole("button", { name: "Unlike" })).toBeVisible()

  // a second user in a browser of their own
  const otherPage = await browser.newPage()
  await signIn(otherPage, "deepduckthoughts@example.com", "password2")
  await otherPage.goto("/quacks")
  const seenByOther = otherPage.getByRole("article").filter({ hasText: text })

  await expect(seenByOther.getByRole("button", { name: "Like" })).toHaveAttribute(
    "aria-pressed",
    "false",
  )
  await expect(seenByOther.getByText("1", { exact: true })).toBeVisible()
  await otherPage.close()
})

test("E3: liking a quack that was just deleted says so", async ({ page }) => {
  const text = `E2E deleted before the like ${Date.now()}`
  await signIn(page, "caffeinatedduck@example.com", "password1")
  const quack = await postQuack(page, text)
  await expect(quack.getByRole("button", { name: "Like" })).toBeVisible()

  // delete it behind the open feed's back
  const quacks: { id: string; text: string | null }[] = await (
    await page.request.get(`${API}/quacks`)
  ).json()
  const { id } = quacks.find((candidate) => candidate.text === text)!
  expect((await page.request.delete(`${API}/quacks/${id}`)).status()).toBe(204)

  await quack.getByRole("button", { name: "Like" }).click()

  await expect(page.getByText("This quack doesn't exist anymore")).toBeVisible()
  // the feed reloads, and the deleted quack is gone from it
  await expect(quack).toHaveCount(0)
})
