import { z } from "zod"

// Lives in lib/ because both the quack feed and the profile settings use it,
// and features may not import from each other.
export const moods = ["happy", "sad", "angry", "silly"] as const

export const moodSchema = z.enum(moods)

export type Mood = z.infer<typeof moodSchema>

// Shared by every mood picker and the feed, so a mood reads the same everywhere.
export const MOOD_DISPLAY: Record<Mood, { emoji: string; label: string }> = {
  happy: { emoji: "😄", label: "Happy" },
  sad: { emoji: "😢", label: "Sad" },
  angry: { emoji: "😠", label: "Angry" },
  silly: { emoji: "🤪", label: "Silly" },
}
