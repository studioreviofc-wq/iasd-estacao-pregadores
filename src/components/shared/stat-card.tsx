import type { LucideIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import type { Tone } from "@/lib/domain/labels"
import { toneClasses } from "@/lib/domain/tone"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "brand",
  hint,
}: {
  label: string
  value: number | string
  icon: LucideIcon
  tone?: Tone
  hint?: string
}) {
  return (
    <Card className="gap-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
        <span className={cn("hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex", toneClasses[tone].icon)}>
          <Icon className="size-4.5" />
        </span>
      </div>
      <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  )
}
