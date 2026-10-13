export const profileKeys = {
  all: () => ["profile"] as const,
  mine: () => [...profileKeys.all(), "mine"] as const,
}
