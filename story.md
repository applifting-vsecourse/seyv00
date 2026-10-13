# Search the feed

People keep losing posts they saw days ago, and they usually remember a word from it or who wrote it. As someone looking for a post I saw earlier, I want to type that word or name and see only the posts that match, so that I can find it again.

## Acceptance criteria

1. On the Quacks page, a search box labelled "Search" sits between the "New quack" form and the feed.
2. Typing filters the feed without pressing Enter or clicking a button.
3. Typing a word from a post's text shows that post.
4. Typing part of an author's display name shows their posts.
5. Typing an author's @username, with or without the leading `@`, shows their posts.
6. Typing several words shows only posts that contain all of them, in any order ("pants duck" shows a post containing "duck … pants").
7. Upper/lower case doesn't matter ("DUCK" and "duck" give the same results).
8. Accents don't matter ("zluva" finds a post containing "Žluva").
9. An empty search box, or one with only spaces, shows the full feed exactly as before.
10. The search term appears in the address bar (e.g. `/quacks?q=duck`).
11. Reloading the page keeps the term in the box and the filtered results.
12. Opening a `/quacks?q=duck` link in a new tab shows the same results.
13. Pressing Back after a search returns to the unfiltered feed.
14. While the box has text, a clear (×) control is visible; clicking it empties the box and shows the full feed.
15. The box accepts at most 100 characters.
16. Posts in the results show their mood, same as in the feed.
17. Posting a quack while a search is active clears the search and shows the new quack at the top of the full feed.

## When there's nothing to show

18. If nothing matches, the feed shows _No quacks match "&lt;term&gt;"._ and a **Clear search** button that brings back the full feed.
19. If there are no posts at all and the box is empty, the feed shows the existing _No quacks yet. Post the first one._
20. While results are loading, the feed shows the same spinner as today.
21. If loading fails, the feed shows the same error and Reload button as today.

## Out of scope

Highlighting matched words, ranking by relevance, filtering by mood, search from the header or other pages, analytics tools or dashboards.

## Developer notes (not acceptance criteria)

- Search runs on the server: `GET /api/quacks?q=…`.
- Every search writes one server log line: user id, timestamp, number of words, number of results. The search text is never logged. This is how we learn whether people use it.
- Accent-insensitive matching needs Postgres's `unaccent` extension, enabled by a migration.
