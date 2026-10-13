import { useEffect, useId, useState } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Mirrors the server-side DTO (MaxLength(100)).
export const SEARCH_MAX_LENGTH = 100

// Long enough to skip a request per keystroke, short enough to feel live.
const DEBOUNCE_MS = 300

type QuackSearchProps = {
  // The applied search (from the URL); "" means no search.
  value: string
  onChange: (value: string) => void
  className?: string
}

export function QuackSearch({ value, onChange, className }: QuackSearchProps) {
  const id = useId()
  const [draft, setDraft] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)

  // The applied search can change without typing (Back button, clearing after
  // a post). Adopt it, unless it is only our own debounced draft coming back.
  if (value !== syncedValue) {
    setSyncedValue(value)
    if (value !== draft.trim()) setDraft(value)
  }

  useEffect(() => {
    const next = draft.trim()
    if (next === value) return
    const timeout = setTimeout(() => onChange(next), DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [draft, value, onChange])

  const clear = () => {
    setDraft("")
    onChange("")
  }

  return (
    <div
      role="search"
      className={cn("flex flex-col gap-2", className)}
    >
      <Label htmlFor={id}>Search</Label>
      <div className="relative">
        <Input
          id={id}
          type="text"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="A word or @someone"
          maxLength={SEARCH_MAX_LENGTH}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="pr-12"
        />
        {draft ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Clear search"
            onClick={clear}
            className="absolute top-1/2 right-1 -translate-y-1/2"
          >
            <X />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
