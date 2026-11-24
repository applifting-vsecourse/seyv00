# Likes on quacks — cases

> "People want to show they like a quack without having to reply. I want a like button and a like count on every quack. Everyone can like a quack only once, and take the like back." — product owner

Each case is written as given / when / then and has an ID. The tests name the case they cover (e.g. `R2`), so a case without a test is easy to spot. Cases R1–R3 are the examples from the request; the rest come from the questions below.

## Decisions

| #   | Question                                  | Decided                                                                                                   |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Can authors like their own quack?         | Yes, like any other quack.                                                                                |
| 2   | Can replies be liked?                     | Yes, the same way as top-level quacks.                                                                    |
| 3   | What happens to a deleted quack's likes?  | They are erased with its content. A placeholder has no Like button and no count and can't be liked (404). |
| 4   | Liking twice / taking back a missing like | Idempotent: no error, the answer is the current state.                                                    |
| 5   | What is shown                             | Only the count and whether I liked it. Who liked a quack is not shown and not in the API.                 |
| 6   | When the UI changes                       | Straight away; if the server refuses, it goes back and a toast says why.                                  |
| 7   | A quack nobody has liked                  | Empty heart, no number. The number appears from 1 up.                                                     |
| 8   | Who can sign in to like                   | Only signed-in users. Signed-out visitors don't see quacks at all today (401), so this doesn't change.    |

## Rules — unit tests

The quack service with the repository mocked. "Me" is the user from the session.

**Liking**

- **R1 — Like.** Given a quack with 0 likes that I haven't liked, when I like it, then its count is 1 and it is liked by me.
- **R2 — Like only once.** Given a quack I have already liked (count 1), when I like it again, then the count stays 1, it is still liked by me and there is no error.
- **R3 — Take the like back.** Given a quack I have liked (count 1), when I take the like back, then the count is 0 and it is not liked by me.
- **R4 — Take back a like that isn't there.** Given a quack I haven't liked (count 0), when I take the like back, then the count stays 0 and there is no error.
- **R5 — Own quack.** Given a quack I wrote, when I like it, then its count goes up by 1 like any other quack.
- **R6 — Replies.** Given a reply with 0 likes, when I like it, then its count is 1 and it is liked by me.

**Whose like**

- **R7 — Liked by me is per user.** Given a quack that another user has liked and I haven't, when I look at it, then its count is 1 and it is not liked by me.
- **R8 — Only my own like goes.** Given a quack liked by me and by another user (count 2), when I take my like back, then the count is 1, it is not liked by me and the other user's like stays.
- **R9 — Nobody removes someone else's like.** Given a quack liked by another user and not by me, when I take "my" like back, even as an admin, then the count stays 1.

**What can't be liked**

- **R10 — Missing quack.** Given no quack with this id, when I like it or take the like back, then I get "not found".
- **R11 — Deleted message.** Given a placeholder _This message was deleted_, when I like it or take the like back, then I get "not found", as if the quack were gone.

## API — integration tests

Real HTTP requests to the Nest app (supertest) against the `quacker_test` database. The like endpoints:

- `PUT /api/quacks/:id/like`: like.
- `DELETE /api/quacks/:id/like`: take the like back.

Both answer `200 { likeCount, likedByMe }` with the state after the request. Every quack in a response also carries `likeCount` and `likedByMe`, including replies.

**Signed in or not**

- **A1 — Signed out.** Given a signed-out visitor, when they send `PUT` or `DELETE /api/quacks/:id/like`, then the answer is 401 and the quack's count doesn't change.

**Like and take back**

- **A2 — Like.** Given a signed-in user and a quack with no likes, when they send `PUT /api/quacks/:id/like`, then the answer is `200 { likeCount: 1, likedByMe: true }`, and `GET /api/quacks` shows that quack with `likeCount: 1, likedByMe: true`.
- **A3 — Like twice.** Given a quack I have liked, when I send `PUT …/like` again, then the answer is `200 { likeCount: 1, likedByMe: true }` and the database holds one like from me on that quack.
- **A4 — Take back, also twice.** Given a quack I have liked, when I send `DELETE …/like`, then the answer is `200 { likeCount: 0, likedByMe: false }`. When I send it again, the answer is the same 200.
- **A5 — Another user sees the count, not my like.** Given a quack I have liked, when another signed-in user loads `GET /api/quacks`, then they see `likeCount: 1, likedByMe: false`. The response contains no list of who liked it.
- **A6 — Own quack and replies.** Given my own quack and a reply under it, when I like both, then each shows `likeCount: 1, likedByMe: true`, in the feed's reply preview and in `GET /api/quacks/:id`.
- **A7 — Admins have no extra power.** Given a quack liked by user B, when an admin sends `DELETE …/like` on it, then the answer is `200 { likeCount: 1, likedByMe: false }` and B's like stays.

**At the same time**

- **A8 — Two people at once.** Given a quack with no likes, when two users send `PUT …/like` at the same moment, then both get 200 and the count is 2.
- **A9 — Same person twice at once.** Given a quack I haven't liked, when I send two `PUT …/like` requests at the same moment, then both get 200 with `likeCount: 1` and the database holds one like. The database enforces one like per person per quack.

**What can't be liked**

- **A10 — Missing quack.** Given an id that no quack has, when I send `PUT` or `DELETE …/like`, then the answer is 404.
- **A11 — Deleted message.** Given a top-level quack with a reply, liked by two users, when its author deletes it, then it becomes a placeholder with no likes left in the database. The feed and `GET /api/quacks/:id` show it with `likeCount: 0, likedByMe: false`, and `PUT` or `DELETE …/like` on it answers 404.

**Likes go with what they belong to**

- **A12 — Deleted quack or reply.** Given a quack without replies and a reply, each liked, when each is deleted, then their likes are gone from the database too.
- **A13 — Deleted account.** Given a quack liked by user B (count 1), when B's account is removed, then the quack's count is 0.

**Nothing else changes**

- **A14 — Order.** Given quacks posted in the order Q1, Q2, Q3, when I like Q1, then `GET /api/quacks`, `?mine` and `?search` still list them by posting time, newest first.
- **A15 — Everywhere a quack appears.** Given a quack I have liked, when I load the feed, "Mine", a search that finds it, or its thread page, then each shows it with `likeCount: 1, likedByMe: true`.

## What the user sees — component tests

The frontend quack item and like button (`*.test.tsx`), with the API mocked.

- **U1 — Nobody has liked it.** Given a quack with 0 likes, when it is shown, then it has an empty heart button labelled "Like" and no number.
- **U2 — Others have liked it.** Given a quack with 3 likes, none of them mine, when it is shown, then the heart is empty, labelled "Like", with "3" next to it.
- **U3 — I have liked it.** Given a quack I have liked (count 1), when it is shown, then the heart is filled, the button is labelled "Unlike" and marked as pressed, and "1" is next to it.
- **U4 — Changes straight away.** Given a quack with 0 likes, when I press Like, then the heart fills and "1" appears before the server answers.
- **U5 — Goes back if the server refuses.** Given I pressed Like on a quack that was deleted in the meantime, when the server answers 404, then the heart is empty again, the number is gone, a toast says _This quack doesn't exist anymore_ and the feed reloads.
- **U6 — Placeholder.** Given a placeholder _This message was deleted_, when it is shown, then it has no Like button and no count.

## End-to-end flows — Playwright

Against the running app and the seeded data.

- **E1 — Like and take it back.** Given I'm signed in and have just posted a quack, it shows an empty heart and no number. When I press Like, then the heart fills and "1" appears. After a reload it is still 1 and filled, so the server kept it. When I press Unlike, then the heart is empty and the number is gone, also after a reload.
- **E2 — Others see the count.** Given user A has liked a quack, when user B signs in and opens the feed, then that quack shows "1" with an empty heart labelled "Like".
- **E3 — Liking a quack that's just been deleted.** Given I have the feed open and the quack is deleted behind my back (through the API), when I press Like on it, then the heart goes back to empty and a toast says _This quack doesn't exist anymore_.

## Out of scope

- Showing who liked a quack.
- Notifications about likes.
- Sorting or filtering by likes; a "most liked" view.
- Likes on a profile page.
- Live updates of counts while the feed is open.
- Admins removing other people's likes.
- Other reactions besides a like.
