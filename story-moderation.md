# Moderators can delete any quack

Someone started posting nasty quacks. Their author won't delete them, and right now nobody else can. As a moderator, I want to delete any quack, so that nasty content leaves the feed without waiting for its author.

The moderator is a user with the `admin` role. The role and the account already exist (`admin@example.com` from the seed); nobody can give themselves the role.

## Deleting

1. An admin sees the **Delete quack** button on every quack in the feed, in the "All" and "Mine" tabs and in search results, not only on their own.
2. Everyone else sees it only on their own quacks, as today.
3. On someone else's quack, the confirmation dialog says whose quack it is: _Delete @username's quack?_ and that it's being removed as a moderator. On the admin's own quack the dialog is the same as everyone's today.
4. Confirming deletes the quack for good, the same as when its author deletes it: it disappears from the feed for everyone, together with its poll answers and votes. It can't be undone.
5. If the quack was already deleted (e.g. by its author a moment earlier), the dialog shows the same error as today.

## The server decides

6. The server allows a delete when the signed-in user wrote the quack **or** is an admin. Anyone else gets 403, whatever the UI shows. The role comes from the session, never from the request.
7. A quack that doesn't exist gets 404, for admins too.
8. When an admin deletes someone else's quack, the server writes one log line: the admin's id, the quack id and the author's id. The quack text is not logged. An author deleting their own quack, admin or not, logs nothing new.

## Out of scope

Hiding instead of deleting, restoring a deleted quack, telling the author, a reason for the deletion, banning users, a moderator role other than `admin`, a moderation screen or queue, reporting quacks, editing someone else's quack.
