export const quackKeys = {
  all: () => ["quacks"] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
  list: (search: string, isMine = false) => [...quackKeys.lists(), { search, isMine }] as const,
  // a quack with all its replies: the thread page and "Show more replies"
  thread: (quackId: string) => [...quackKeys.all(), "thread", quackId] as const,
  // mutation key, so a poll can find its own pending and failed votes
  vote: (quackId: string) => [...quackKeys.all(), "vote", quackId] as const,
}
