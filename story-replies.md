# Replies to quacks

People discuss a quack by posting a new quack that starts with "@name…", and then nobody can tell who is answering what. As someone reading the feed, I want to reply to a quack and see the replies under it, so that a conversation stays together and it's clear what each reply responds to.

Replies belong to the people who wrote them: when an author deletes a quack that already has replies, the replies stay. And when anyone deletes their own quack, its content really disappears from the app.

## Replying

1. Every quack in the feed, and every reply, has a **Reply** button.
2. Reply on a quack opens a reply form under the thread. Reply on a reply opens the same form for the same thread, with `@username ` of that reply's author prefilled in the text.
3. The reply form has the same text and mood fields as the "New quack" form, with the same rules and the default mood from Settings preselected. It has no **Add poll**.
4. A reply always belongs to a top-level quack. There are no replies nested under replies.
5. Posting a reply adds it at the end of the thread; the form resets.
6. People can reply to a thread whose top-level quack was deleted.

## Seeing replies

7. The feed ("All" and "Mine" without a filter) lists threads: top-level quacks, newest first, ordered by when the top-level quack was posted. A new reply does not move a thread up.
8. Under each quack in the feed, its first 3 replies are shown, oldest first, with the author and time like any quack.
9. If there are more, a **Show more replies (N)** button expands the rest in place.
10. Clicking a quack's time (or the reply count) opens the thread page `/quacks/:id`: the top-level quack and all its replies, oldest first, and the reply form. The page can be opened from a link.
11. The "Mine" tab shows the user's quacks **and** replies. A reply there has a header _↳ reply to @username_ (or _↳ reply to a deleted message_) linking to its thread.
12. Search finds quacks and replies by their text and author, the same way it does today. A reply in the results has the same header as in 11.

## Deleting

13. Deleting works as today: the author, or an admin, can delete any quack or reply. The same confirmation dialog, 403/404 rules and moderation log line apply.
14. Deleting a reply removes it for good.
15. Deleting a top-level quack **without** replies removes it for good, as today, together with its poll answers and votes.
16. Deleting a top-level quack **with** replies replaces it with _This message was deleted_. Its text, mood, poll (answers and votes) and author are removed from the database; only the empty placeholder stays so that the thread holds together. The replies are untouched.
17. A deleted top-level quack with replies stays in the feed, in its place, showing _This message was deleted_ and its replies. It has no author, no time link to a profile, no Delete button and no poll.
18. When the last reply under a deleted message is deleted, the placeholder is deleted too, in the same operation. A placeholder with no replies never appears anywhere, even if the replies disappeared some other way (e.g. a deleted account).
19. Opening a thread that no longer exists shows _This thread doesn't exist anymore_ (404).
20. Content of a deleted quack never appears in the API, in search, or in the "Mine" tab.

## The server decides

21. `POST /api/quacks/:id/replies` creates a reply. The author comes from the session. The server returns 404 if the quack doesn't exist, 400 if it is itself a reply (no nesting) and 400 if the body contains a poll.
22. The server, not the UI, chooses between deleting a quack and replacing it with a placeholder. A delete that races with a new reply never loses the reply: the database refuses to delete a quack that has replies, and the server then makes the placeholder.
23. Two people deleting the last two replies under a placeholder at the same time end with the placeholder gone and no error.

## Out of scope

Notifications about replies, nested threads, editing quacks or replies, converting old "@name…" quacks into replies, live updates of threads, moving a thread up the feed when it gets a new reply, a separate profile page, restoring deleted quacks.

## Where it lands

- **Backend, `modules/quack`**: the `Quack` domain type (nullable author and text, `isDeleted`, `parent`, `replyCount`, reply preview); the repository (feed, "Mine", search and thread queries, create reply, delete-or-placeholder, placeholder cleanup); the service (reply rules, delete branching, permission checks as today); the controller (`GET /api/quacks/:id` for the thread page and for **Show more replies**, `POST /api/quacks/:id/replies`) and response DTOs. The seed gets a couple of threads.
- **Frontend, `features/quack`**: the feed item (reply list, **Show more**, **Reply**, placeholder state), the reply form (the quack form without the poll), the reply header in "Mine" and search, zod schemas, the delete dialog. A new route `routes/_ProtectedPages/quacks.$id.tsx` for the thread page.
- **Touches existing features**: feed, "Mine" filter, search (raw SQL with `unaccent`), delete and admin moderation, polls (deleted with the content), default mood.
- **E2E**: reply and see it under the quack; delete a quack with replies and see the placeholder with the replies; delete the last reply and see the thread vanish.

## Decisions

| #   | Decision                                                         | Chosen                                                                        | Rejected and why                                                                                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What a reply is                                                  | A `Quack` with an optional `parentId`                                         | A separate `Reply` model: duplicates the repository, DTOs, deletion and moderation, and search would miss replies. Merging two tables later with production data is costly.                                                                                                                         |
| 2   | Deleting a quack that has replies                                | Placeholder: keep the row, erase its content                                  | Hard delete with `SetNull`: replies lose their context, which is today's problem again, and the link can never be restored. Hard delete with a dangling `parentId` and no foreign key: the database stops guarding integrity and the thread can't be loaded.                                        |
| 3   | Does the placeholder keep its author                             | No, `userId` is set to `NULL`                                                 | Keeping the author and hiding it in the UI: the database still says "this person wrote something here", one API field away from leaking. The requirement says the content must really disappear.                                                                                                    |
| 4   | Replies in the feed                                              | Only threads, first 3 replies expanded, **Show more**                         | Replies also as separate feed items: the same conversation would appear several times, close to today's "@name…" noise.                                                                                                                                                                             |
| 5   | Nesting                                                          | One level; replying to a reply goes into the same thread with `@username`     | A tree of any depth: recursive queries, placeholders mid-tree, hard to display, and it can't be flattened later without losing information. A flat thread with both `parentId` and `rootId`: a derived value to keep consistent, for a "who answered whom" feature nobody asked for.                |
| 6   | What the database does when a quack with replies is hard-deleted | Refuse (`ON DELETE NO ACTION` on `parentId`); `CASCADE` from the author stays | `SET NULL`: a bug would silently break threads. `CASCADE`: deletes other people's replies, which contradicts the requirement. `RESTRICT` instead of `NO ACTION`: checked mid-cascade, so deleting an account whose quack has only the same person's replies would fail even though everything goes. |
| 7   | A placeholder whose last reply is deleted                        | Deleted in the same transaction; queries hide empty placeholders anyway       | Keeping it forever: empty rows pile up and a link leads to an empty page.                                                                                                                                                                                                                           |
| 8   | Replying to a deleted thread                                     | Allowed                                                                       | Locking the thread: the author could end a discussion they dislike by deleting the first quack.                                                                                                                                                                                                     |

## Proposed schema

Only `Quack` changes. Everything else in `schema.prisma` stays as it is.

```prisma
model Quack {
  id          String       @id @default(cuid())
  // NULL only on a placeholder for a deleted quack that still has replies
  text        String?      @db.Text
  mood        QuackMood?
  // NULL only on a placeholder; deleting the account still deletes the
  // account's live quacks, and fails (see parent) if one still has replies
  user        User?        @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @default(now()) @updatedAt
  // set when a quack with replies was deleted: text, mood, author and poll are gone
  deletedAt   DateTime?
  // a quack with a parent is a reply; replies are one level deep (checked in the service)
  parent      Quack?       @relation("QuackReplies", fields: [parentId], references: [id], onDelete: NoAction)
  parentId    String?
  replies     Quack[]      @relation("QuackReplies")
  // a quack with answers is a poll; the quack text is its question
  pollOptions PollOption[]
  pollVotes   PollVote[]

  @@index([userId])
  // the replies of a thread, oldest first
  @@index([parentId, createdAt])
  @@map("quack")
}
```

Prisma can't express a CHECK constraint, so the migration adds one by hand. It makes a placeholder all-or-nothing and keeps placeholders at the top level (replies are always deleted for good):

```sql
ALTER TABLE "quack" ADD CONSTRAINT "quack_placeholder_check" CHECK (
  ("deletedAt" IS NULL AND "text" IS NOT NULL AND "userId" IS NOT NULL)
  OR
  ("deletedAt" IS NOT NULL AND "text" IS NULL AND "userId" IS NULL
     AND "mood" IS NULL AND "parentId" IS NULL)
);
```

"Replies are one level deep" spans two rows, so a CHECK can't enforce it. The service checks it when creating a reply; a quack's `parentId` never changes afterwards, so the check can't go stale.
