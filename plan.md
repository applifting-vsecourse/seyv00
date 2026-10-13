# Plan: polls on quacks

Implements [story.md](story.md). Numbers in brackets, like [11], refer to its acceptance criteria. The plan follows the quack feature's existing pattern: Prisma model, repository, service, DTO-validated controller, zod schema, TanStack Query, component.

## Data model

A poll is not a separate entity. It is a quack that has answers. A quack with no `PollOption` rows is an ordinary quack, so existing quacks need no migration of data [25].

```prisma
model PollOption {
  id       String     @id @default(cuid())
  quack    Quack      @relation(fields: [quackId], references: [id], onDelete: Cascade)
  quackId  String
  text     String     @db.VarChar(50)
  position Int        // 0–3, the order the author typed them in
  votes    PollVote[]

  @@unique([quackId, position])
  @@unique([id, quackId]) // target of PollVote's composite foreign key
  @@map("poll_option")
}

model PollVote {
  quack     Quack      @relation(fields: [quackId], references: [id], onDelete: Cascade)
  quackId   String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  option    PollOption @relation(fields: [optionId, quackId], references: [id, quackId], onDelete: Cascade)
  optionId  String
  createdAt DateTime   @default(now())
  updatedAt DateTime   @default(now()) @updatedAt

  @@id([quackId, userId]) // one person, one vote per poll [10, 20]
  @@index([optionId])
  @@index([userId]) // the primary key starts with quackId; deleting a user needs this
  @@map("poll_vote")
}
```

Plus the back-relations `Quack.pollOptions`, `Quack.pollVotes` and `User.pollVotes`.

Why it looks like this:

- **`@@id([quackId, userId])`.** The database itself guarantees one vote per person per poll. Two tabs voting at the same moment can't create two rows [20].
- **Composite foreign key `(optionId, quackId)`.** A vote can only point at an answer of the same poll. A bug or a crafted request can't count a vote for poll A toward poll B.
- **Changing a vote updates the row; nobody deletes it.** There is no withdraw [11], so the row only ever moves between answers.
- **No stored counters.** Counts are always `COUNT(*)` over `poll_vote`, so they can't drift [20].
- **`text VARCHAR(50)`** matches the 50-character limit [4] at the database level too. Postgres counts characters (code points), so every layer has to count the same way: class-validator's `MaxLength` already does, and the form counts `[...text].length` rather than zod's UTF-16 `.max()`, so an emoji counts as one character everywhere.
- **Enforced by the application, not the database:** 2–4 answers, distinct answers, `position` 0–3. Prisma can't express `CHECK` constraints or expression indexes like `lower(text)`, and hand-written ones in a migration risk being dropped by a later `migrate dev`. Options are written in exactly one place (the nested create) and never edited, so that one check is enough.

Verified before any code, on a scratch copy of the schema and in a rolled-back transaction on the dev database. `prisma validate` accepts the overlapping `quackId` and generates the composite foreign key. Postgres rejects a vote for another poll's answer, both on insert and on update, and rejects a second vote row for the same person. Deleting a quack cascades to its answers and votes.

## API

All endpoints are behind `AuthenticatedUserGuard`. The voter and the author always come from the session.

### `POST /api/quacks`: create (extended)

`CreateQuackDto` gains an optional `poll`:

```jsonc
{
  "text": "Lunch?",
  "mood": "happy",
  "poll": { "options": ["Pizza", "Thai", "Salad"] },
}
```

- `poll.options`: array of 2–4 strings [4], each trimmed and 1–50 characters long. They must be unique ignoring case (`ArrayUnique` with a lowercase identifier) [5]. `poll` is a nested DTO, so it needs `@ValidateNested` and `@Type`, otherwise `forbidNonWhitelisted` never looks inside it. Each answer is trimmed by a `@Transform` before validation runs.
- Absent or `null` means an ordinary quack. Validation errors return 400 [6].
- The quack and its options are created in one `prisma.quack.create` with nested `pollOptions.create`, so a poll can never exist with half its answers.
- Log line: `poll created userId=… options=3`. No texts [dev notes].

### `GET /api/quacks[?q=…]`: feed (extended)

Every `QuackResponseDto` gains `poll`, which is `null` for ordinary quacks:

```jsonc
"poll": {
  "options": [{ "id": "…", "text": "Pizza", "votes": 4 }, …], // in position order
  "totalVotes": 7,
  "myOptionId": "…" | null,
  "isAuthor": false
}
```

- `votes` are always sent. The UI hides them until the user has voted or is the author [14, 15]. That is what we agreed: the counts aren't secret, and a first vote needs them to update instantly [18].
- The repository loads them with **two extra queries per feed load, regardless of how many polls it contains**: a `groupBy optionId` count over `poll_vote` for the feed's quack ids, and the caller's own votes for those ids. The options themselves come in through `include`. Putting the shared `include` in one constant keeps `getQuacks` and `searchQuacks` in step.
- Search keeps matching only `quack.text`, author name and username, so poll answers aren't searched [23]. No change to its SQL.

### `PUT /api/quacks/:id/vote`: vote (new)

```jsonc
// request
{ "optionId": "…" }
// 200 response: the poll's fresh state, same shape as `poll` above [21]
```

- It is an upsert on `(quackId, userId)`: the first call creates the vote and later calls move it [10, 11]. It's written as raw SQL rather than Prisma's `upsert`, because Prisma only makes `upsert` a single atomic statement under certain conditions. Otherwise it reads and then writes, and two tabs casting a first vote at once would get a 500:

  ```sql
  INSERT INTO "poll_vote" ("quackId", "userId", "optionId") VALUES (…)
  ON CONFLICT ("quackId", "userId") DO UPDATE
    SET "optionId" = EXCLUDED."optionId", "updatedAt" = now()
    WHERE "poll_vote"."optionId" IS DISTINCT FROM EXCLUDED."optionId"
  RETURNING (xmax = 0) AS inserted
  ```

  The statement returns `true` for a first vote, `false` for a change, and no row when the answer was already chosen. That was checked on the dev database. `PUT` because repeating it changes nothing [11].

- **404** if the quack doesn't exist or has no poll. **400** if `optionId` isn't one of its answers. The service checks this before writing, and the composite foreign key is the backstop.
- Log line: `poll vote userId=… quackId=… kind=first|change|same`, taken from what the upsert returned, so it is exact even when two tabs race.

## Frontend

**Schemas and types** (`features/quack/api/quackSchemas.ts`): `pollSchema` and `quackSchema.poll: pollSchema.nullable()`. The landing page sample and the test fixtures get `poll: null`.

**Creating** (`QuackForm`):

- A `poll: { options: { text }[] } | null` field, edited through `useFieldArray`.
- **Add poll** fills in two empty answers, **Add answer** adds up to 4, × removes answers 3 and 4, **Remove poll** sets it back to `null` [1–3].
- The zod schema mirrors the DTO. A `superRefine` puts "Answers must be different" under the duplicate [4–6].
- After posting, the reset already in place goes back to `{ text: "", mood: defaultMood, poll: null }` [7, 8].

**Showing** (`QuackPoll` component, rendered by `QuackItem` when `quack.poll`):

- Answers are `<Button>`s with `aria-pressed` [9, 13].
- `showResults = myOptionId !== null || isAuthor`. When results are shown, each answer gets count, rounded percentage, a bar (`bg-secondary`, width from the percentage) and a check mark on the user's own choice [14, 15].
- The total reads "No votes yet", "1 vote" or "N votes" [16].
- Mood shows in the quack header as today [24].

**Voting** (`useVote` hook in `features/quack/hooks/`):

- **The cache holds only server state.** The optimistic vote is an overlay. `QuackPoll` reads the latest _pending_ vote for its quack with `useMutationState({ filters: { mutationKey: ["vote", quackId], status: "pending" } })` and draws the poll as if that vote had happened: −1 on the old answer, +1 on the new one, `totalVotes` +1 only on a first vote [18]. A focus refetch while a vote is pending can't wipe that overlay, because the overlay isn't in the cache.
- **Last click wins [12].** Mutations share `scope: { id: "vote-<quackId>" }`, so requests for one poll go out one at a time in click order and the server ends on the last click. The overlay always shows the newest pending click. (`onMutate` runs immediately even for a queued mutation; checked in query-core 5.101.4.)
- **Failure [19].** A failed vote stops being pending, so its overlay disappears and the poll is back on the server state from before the click. The poll shows _Your vote didn't go through. Try again._ while the latest settled vote for that poll is an error, and the next successful vote clears it.
- **Success [21].** The server's poll replaces that poll in every `quackKeys.lists()` cache via `setQueriesData`. There is no feed-wide invalidate, so the feed doesn't flicker. Other polls refresh on focus as today [22].

## Order to build it in

Each step ends green (`pnpm backend test`, `pnpm frontend test:ci`, type-check, lint) and is a sensible commit on `feature/quack-polls`.

1. **Schema, migration, seed.** Add both models and the migration, check it with `prisma migrate diff` (it should come back empty), and add one seeded poll with a few votes. That gives us something to look at in later steps.
2. **Read path, backend.** The shared `include`, the counts and my-vote queries in the repository, the `poll` field in `QuackResponseDto`. Service tests: an ordinary quack still has `poll: null`, a poll's counts are correct, `myOptionId` belongs to the caller.
3. **Read path, frontend.** `pollSchema` and `QuackPoll` in read-only form, covering hidden and shown results, percentages and plural forms. Component tests for [14–17]. After this step the seeded poll renders.
4. **Create path.** The DTO with its validation and the nested create plus log line on the backend. On the frontend, the poll editing in `QuackForm`. Tests: DTO rules [4–6] and form behaviour [1–3, 6, 8].
5. **Vote path, backend.** The endpoint, the upsert, the 404 and 400 checks, the log line. Service tests for first vote, change, same-answer no-op, wrong option and not-a-poll.
6. **Vote path, frontend.** `useVote` with the overlay, error message and scope. Tests: an instant update before the request resolves, a return to the server state plus the message on a rejected request, and the last of three rapid clicks winning.
7. **Wrap-up.** A search regression test showing that answers don't match [23]. An API smoke test with two users via curl, including two concurrent first votes from one user, after which `poll_vote` must hold exactly one row for them [20]. Then `pnpm check-all`.

## Risks and things to verify

- ~~Prisma and the overlapping `quackId`~~: verified, see the data model section.
- ~~Scoped mutations delaying `onMutate`~~: verified, they don't.
- **Several votes in flight.** The overlay design makes the outcome follow from the queue, but step 6 must still test that the final state after a failed middle click is correct.
- **No feed pagination.** The counts query covers every quack id in the feed. That's fine at today's sizes, and the cost stays at two queries; it grows with the feed together with everything else.
