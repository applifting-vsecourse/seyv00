import type { QuackMood as QuackMoodValue } from "@/features/quack/api/quackSchemas"

// Shared by the form's mood picker and the feed, so a mood reads the same in both.
export const QUACK_MOOD_DISPLAY: Record<QuackMoodValue, { emoji: string; label: string }> = {
  happy: { emoji: "😄", label: "Happy" },
  sad: { emoji: "😢", label: "Sad" },
  angry: { emoji: "😠", label: "Angry" },
  silly: { emoji: "🤪", label: "Silly" },
}

type QuackMoodProps = { mood: QuackMoodValue }

export function QuackMood({ mood }: QuackMoodProps) {
  const { emoji, label } = QUACK_MOOD_DISPLAY[mood]

  return (
    <span className="text-xs text-muted-foreground">
      <span aria-hidden="true">{emoji}</span> {label}
    </span>
  )
}
