# Polls on quacks

People ask questions in posts ("where do we go for lunch?") and then count the replies by hand. Someone always gets the numbers wrong, and the question gets buried under replies. As someone asking a question, I want to offer a few answers to choose from and let people pick one, so that everyone sees the same, correct count for each answer without anyone counting by hand.

## Creating a poll

1. In the "New quack" form, an **Add poll** button turns the quack into a poll. The quack text is the question.
2. Adding a poll shows two answer fields. **Add answer** adds another, up to 4 in total; each field beyond the first two has a remove (×) control with an `aria-label`. When there are 4 answers, **Add answer** is no longer shown.
3. **Remove poll** takes the answers away, leaving an ordinary quack.
4. A poll has 2–4 answers. Each answer is 1–50 characters after trimming spaces.
5. Two answers can't be the same (ignoring upper/lower case and surrounding spaces).
6. Breaking any rule in 4–5 shows a message under the offending field and posts nothing. The server enforces the same rules.
7. A poll can have a mood like any quack, and the form preselects the default mood from Settings as usual.
8. After posting, the form resets to an ordinary quack with no poll.

## Voting

9. In the feed, a poll shows the question and its answers. Anyone signed in, including the author, can vote.
10. Each person has at most one vote per poll. Clicking an answer casts that vote.
11. Clicking a different answer moves the vote to it. Clicking the answer already chosen does nothing. A vote can be changed but not withdrawn.
12. If someone clicks several answers in quick succession, the last click is their vote.
13. Answers are buttons (keyboard-operable). The chosen answer is marked visibly and to screen readers (`aria-pressed`).

## Results

14. Before voting, a person sees the answers and the total number of votes ("12 votes"), but not the per-answer counts.
15. Once someone has voted, and always for the poll's author, each answer shows its vote count, its percentage (whole numbers), and a bar sized to the percentage. Their own choice is marked.
16. The total shows below the answers, with correct singular/plural: "No votes yet", "1 vote", "2 votes".
17. Nobody can see who voted for what.

## Feeling instant, and staying correct

18. A vote shows on screen immediately: the chosen answer is marked and the counts update, without waiting for the server.
19. If the server rejects the vote or can't be reached, the poll goes back to how it was before the click, and the poll shows _Your vote didn't go through. Try again._ The message disappears when the next vote succeeds.
20. Counts always come from the server: one person counts once per poll, even if they vote from two tabs at the same time.
21. After a vote succeeds, the poll shows the server's current counts, including other people's votes since the feed loaded.
22. Other people's votes show up when the tab regains focus or after my own vote. The feed does not update live or on a timer.

## Fits with what's there

23. Searching the feed finds a poll by the words of its question, not of its answers.
24. A poll with a mood shows the mood like any quack.
25. Quacks without a poll look and behave exactly as before.

## Out of scope

Closing or ending polls, deadlines, multiple-choice voting, withdrawing a vote, seeing who voted, editing or deleting a poll, live updates, notifications, polls on the landing page sample, analytics tools or dashboards.

## Developer notes (not acceptance criteria)

- Uniqueness is enforced by the database (one vote row per user per poll), not only by application code, so concurrent votes can't double count.
- Voting is an upsert: `PUT /api/quacks/:id/vote` with `{ optionId }`, the voter taken from the session. The response is the poll's fresh counts and the caller's choice.
- The feed response carries each poll's options with their counts, the caller's vote, and the total. Per-answer counts are always sent and hidden by the UI until rule 15 allows them: hiding them is about not swaying the vote, not secrecy, and the client needs them to update a first vote instantly (rule 18).
- Usage logging, same spirit as search: one server log line when a poll is created (user id, number of answers), and one per vote (user id, quack id, whether it's a first vote or a change). Question and answer texts are never logged.
- This branch is stacked on `feature/user-settings` (default mood).
