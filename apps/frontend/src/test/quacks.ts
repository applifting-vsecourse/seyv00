import type { LiveQuack, Quack, Reply } from "@/features/quack/api/quackSchemas"

// Test data shared by the quack component tests.

export const aQuack = (overrides: Partial<LiveQuack> = {}): LiveQuack => ({
  id: "q1",
  text: "quack quack",
  mood: null,
  poll: null,
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  isDeleted: false,
  parentId: null,
  parent: null,
  replyCount: 0,
  replies: [],
  ...overrides,
})

export const aReply = (overrides: Partial<Reply> = {}): Reply => ({
  id: "r1",
  text: "quack back",
  mood: null,
  poll: null,
  userId: "u2",
  createdAt: new Date("2026-01-01T12:05:00Z"),
  user: { id: "u2", name: "Bread Critic", username: "BreadCritic" },
  isDeleted: false,
  parentId: "q1",
  parent: { id: "q1", isDeleted: false, username: "CaffeinatedDuck" },
  replyCount: 0,
  ...overrides,
})

// What's left of a deleted quack that has replies.
export const aDeletedQuack = (replies: Reply[], replyCount = replies.length): Quack => ({
  id: "q1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  isDeleted: true,
  parentId: null,
  parent: null,
  replyCount,
  replies,
})
