export const quackKeys = {
  all: () => ["quacks"] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
  list: (search: string) => [...quackKeys.lists(), { search }] as const,
  // mutation key, so a poll can find its own pending and failed votes
  vote: (quackId: string) => [...quackKeys.all(), "vote", quackId] as const,
}
