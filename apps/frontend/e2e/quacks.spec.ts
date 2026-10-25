import { expect, test, type Page } from "@playwright/test"

import { signIn } from "./signIn"

const API = "http://localhost:4050/api"

async function findQuackNotBy(page: Page, username: string): Promise<{ id: string }> {
  const quacks: { id: string; user: { username: string } }[] = await (
    await page.request.get(`${API}/quacks`)
  ).json()
  return quacks.find((quack) => quack.user.username !== username)!
}

test("author can post a quack and delete it", async ({ page }) => {
  const text = `E2E quack ${Date.now()}`
  await signIn(page, "caffeinatedduck@example.com", "password1")
  await page.goto("/quacks")

  await page.getByLabel("New quack").fill(text)
  await page.getByRole("button", { name: "Quack", exact: true }).click()
  const quack = page.getByRole("article").filter({ hasText: text })
  await expect(quack).toBeVisible()

  await quack.getByRole("button", { name: "Delete quack" }).click()
  const dialog = page.getByRole("alertdialog")
  await dialog.getByRole("button", { name: "Delete" }).click()
  // An open dialog hides the feed from getByRole, so a refused delete would
  // pass the count check below; the dialog closes only on success.
  await expect(dialog).toBeHidden()
  await expect(quack).toHaveCount(0)
})

test("nobody can delete someone else's quack", async ({ page }) => {
  await signIn(page, "deepduckthoughts@example.com", "password2")
  await page.goto("/quacks")

  const othersQuack = page.getByRole("article").filter({ hasNotText: "@DeepDuckThoughts" }).first()
  // Wait for the feed; before it loads there's no button to find either.
  await expect(othersQuack).toBeVisible()
  await expect(othersQuack.getByRole("button", { name: "Delete quack" })).toHaveCount(0)

  // The button is hidden. Now skip the UI and ask the server directly.
  const notMine = await findQuackNotBy(page, "DeepDuckThoughts")
  const response = await page.request.delete(`${API}/quacks/${notMine.id}`)
  expect(response.status()).toBe(403)
})
