import type { Ref } from "react"

import { FormControl } from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MOOD_DISPLAY, moods, moodSchema, type Mood } from "@/lib/moods"

// Radix Select can't hold an empty value, so "no mood" gets its own sentinel
// in the picker and becomes null in the form state.
const NO_MOOD = "none"

type MoodSelectProps = {
  value: Mood | null
  onChange: (mood: Mood | null) => void
  onBlur?: () => void
  ref?: Ref<HTMLButtonElement>
  isDisabled?: boolean
}

// Render inside a <FormItem>: the trigger is the form control the label points at.
export function MoodSelect({ value, onChange, onBlur, ref, isDisabled }: MoodSelectProps) {
  return (
    <Select
      value={value ?? NO_MOOD}
      onValueChange={(next) => onChange(next === NO_MOOD ? null : moodSchema.parse(next))}
      disabled={isDisabled}
    >
      <FormControl>
        <SelectTrigger
          ref={ref}
          onBlur={onBlur}
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        <SelectItem value={NO_MOOD}>No mood</SelectItem>
        {moods.map((mood) => (
          <SelectItem
            key={mood}
            value={mood}
          >
            <span aria-hidden="true">{MOOD_DISPLAY[mood].emoji}</span>
            {MOOD_DISPLAY[mood].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
