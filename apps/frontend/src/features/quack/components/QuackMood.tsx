import { MOOD_DISPLAY, type Mood } from "@/lib/moods"

type QuackMoodProps = { mood: Mood }

export function QuackMood({ mood }: QuackMoodProps) {
  const { emoji, label } = MOOD_DISPLAY[mood]

  return (
    <span className="text-xs text-muted-foreground">
      <span aria-hidden="true">{emoji}</span> {label}
    </span>
  )
}
