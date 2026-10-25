import { expect, test } from "@playwright/test"

import { signIn } from "./signIn"

test("an admin can delete someone else's quack", async ({ browser }) => {
  const text = `E2E nasty quack ${Date.now()}`

  // The author posts, in their own browser context.
  const author = await (await browser.newContext()).newPage()
  await signIn(author, "caffeinatedduck@example.com", "password1")
  await author.goto("/quacks")
  await author.getByLabel("New quack").fill(text)
  await author.getByRole("button", { name: "Quack", exact: true }).click()
  await expect(author.getByRole("article").filter({ hasText: text })).toBeVisible()

  // The admin deletes it.
  const admin = await (await browser.newContext()).newPage()
  await signIn(admin, "admin@example.com", "adminpassword")
  await admin.goto("/quacks")
  const quack = admin.getByRole("article").filter({ hasText: text })
  await quack.getByRole("button", { name: "Delete quack" }).click()
  const dialog = admin.getByRole("alertdialog", { name: "Delete @CaffeinatedDuck's quack?" })
  await dialog.getByRole("button", { name: "Delete" }).click()
  // A refused delete keeps the dialog open with the error, and an open
  // dialog hides the feed from getByRole, so check the dialog first.
  await expect(dialog).toBeHidden()
  await expect(quack).toHaveCount(0)

  // Gone for the author too, not just hidden from the admin. Wait for the
  // feed to load, or "no such quack" holds while it's still empty.
  await author.reload()
  await expect(author.getByRole("article").first()).toBeVisible()
  await expect(author.getByRole("article").filter({ hasText: text })).toHaveCount(0)
})
