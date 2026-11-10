import { expect, test, type Page } from "@playwright/test"

import { signIn } from "./signIn"

const API = "http://localhost:4050/api"

async function signedIn(page: Page, email: string, password: string) {
  await signIn(page, email, password)
  return page
}

// Posts through the API, as the page's signed-in user.
async function postQuack(page: Page, text: string): Promise<string> {
  const response = await page.request.post(`${API}/quacks`, { data: { text } })
  expect(response.status()).toBe(201)
  return ((await response.json()) as { id: string }).id
}

async function postReply(page: Page, quackId: string, text: string): Promise<string> {
  const response = await page.request.post(`${API}/quacks/${quackId}/replies`, { data: { text } })
  expect(response.status()).toBe(201)
  return ((await response.json()) as { id: string }).id
}

test("a reply shows up under the quack it answers", async ({ browser }) => {
  const quackText = `E2E question ${Date.now()}`
  const replyText = `E2E answer ${Date.now()}`
  const author = await signedIn(
    await (await browser.newContext()).newPage(),
    "caffeinatedduck@example.com",
    "password1",
  )
  const quackId = await postQuack(author, quackText)

  const replier = await signedIn(
    await (await browser.newContext()).newPage(),
    "deepduckthoughts@example.com",
    "password2",
  )
  await replier.goto("/quacks")
  const quack = replier.getByRole("article").filter({ hasText: quackText })
  await quack.getByRole("button", { name: "Reply to @CaffeinatedDuck" }).click()
  await replier.getByRole("textbox", { name: "Your reply" }).fill(replyText)
  await replier.getByRole("button", { name: "Post reply" }).click()
  // the form closes only once the server took the reply
  await expect(replier.getByRole("textbox", { name: "Your reply" })).toBeHidden()

  // The author sees it on the thread page, under their quack.
  await author.goto(`/quacks/${quackId}`)
  const [first, second] = [author.getByRole("article").nth(0), author.getByRole("article").nth(1)]
  await expect(first).toContainText(quackText)
  await expect(second).toContainText(replyText)
  await expect(second).toContainText("@DeepDuckThoughts")
})

test("deleting a quack keeps its replies under a placeholder, until the last one goes", async ({
  browser,
}) => {
  const quackText = `E2E soon deleted ${Date.now()}`
  const replyText = `E2E reply that stays ${Date.now()}`
  const author = await signedIn(
    await (await browser.newContext()).newPage(),
    "caffeinatedduck@example.com",
    "password1",
  )
  const quackId = await postQuack(author, quackText)
  const replier = await signedIn(
    await (await browser.newContext()).newPage(),
    "deepduckthoughts@example.com",
    "password2",
  )
  await postReply(replier, quackId, replyText)

  // The author deletes their quack.
  await author.goto(`/quacks/${quackId}`)
  await author
    .getByRole("article")
    .filter({ hasText: quackText })
    .getByRole("button", { name: "Delete quack" })
    .click()
  const dialog = author.getByRole("alertdialog")
  await expect(dialog).toContainText("The replies stay")
  await dialog.getByRole("button", { name: "Delete" }).click()
  // A refused delete keeps the dialog open, and an open dialog hides the page
  // from getByRole, so wait for it to close before looking at the thread.
  await expect(dialog).toBeHidden()

  // Someone else, fresh from the server: the reply is still there, the quack is not.
  await replier.goto(`/quacks/${quackId}`)
  await expect(replier.getByText(replyText)).toBeVisible()
  await expect(replier.getByText("This message was deleted")).toBeVisible()
  await expect(replier.getByText(quackText)).toHaveCount(0)
  await expect(replier.getByText("@CaffeinatedDuck")).toHaveCount(0)

  // The last reply goes, and the empty thread goes with it.
  await replier
    .getByRole("article")
    .filter({ hasText: replyText })
    .getByRole("button", { name: "Delete quack" })
    .click()
  await replier.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()
  await expect(replier.getByRole("alertdialog")).toBeHidden()
  await replier.reload()
  await expect(replier.getByText("This thread doesn't exist anymore.")).toBeVisible()
})
