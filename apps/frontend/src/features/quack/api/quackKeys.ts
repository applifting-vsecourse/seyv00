export const quackKeys = {
  all: () => ["quacks"] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
  list: (search: string, isMine = false) => [...quackKeys.lists(), { search, isMine }] as const,
  // a quack with all its replies: the thread page and "Show more replies"
  threads: () => [...quackKeys.all(), "thread"] as const,
  thread: (quackId: string) => [...quackKeys.threads(), quackId] as const,
  // mutation key, so a poll can find its own pending and failed votes
  vote: (quackId: string) => [...quackKeys.all(), "vote", quackId] as const,
  // mutation key, so a like button can draw its own like in flight
  like: (quackId: string) => [...quackKeys.all(), "like", quackId] as const,
}
