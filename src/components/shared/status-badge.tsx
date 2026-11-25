import { cn } from "@/lib/utils"
import type { Tone } from "@/lib/domain/labels"
import { toneClasses } from "@/lib/domain/tone"

export function StatusBadge({ tone, label, className, title }: { tone: Tone; label: string; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone].soft,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", toneClasses[tone].dot)} aria-hidden />
      {label}
    </span>
  )
}
