import type { LucideIcon } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import type { ServiceWithPreacher } from "@/lib/data/types"
import { formatDate, formatTime, fromISODate } from "@/lib/domain/dates"
import { preacherCategoryLabel, serviceName, servicePeriodLabel, serviceStatusMeta } from "@/lib/domain/labels"
import { toneClasses } from "@/lib/domain/tone"

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export function DateBlock({ date }: { date: string }) {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-background py-1.5">
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {WEEKDAY_SHORT[fromISODate(date).getDay()]}
      </span>
      <span className="text-lg leading-none font-semibold tabular-nums">{formatDate(date, "dd")}</span>
      <span className="text-[10px] text-muted-foreground uppercase">{formatDate(date, "MMM")}</span>
    </div>
  )
}

export function ServiceList({
  items,
  empty,
}: {
  items: ServiceWithPreacher[]
  empty: { icon: LucideIcon; title: string; description?: string }
}) {
  if (items.length === 0) return <EmptyState compact {...empty} />

  return (
    <ul className="divide-y divide-border">
      {items.map((service) => {
        const status = serviceStatusMeta[service.status]
        const time = formatTime(service.start_time)
        return (
          <li key={service.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <DateBlock date={service.service_date} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {service.preacher?.full_name ?? <span className="text-muted-foreground">Pregador a definir</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {serviceName(service)} · {servicePeriodLabel[service.period]}
                {time ? ` · ${time}` : ""}
                {service.preacher ? ` · ${preacherCategoryLabel[service.preacher.category]}` : ""}
              </p>
            </div>
            <StatusBadge tone={status.tone} label={status.label} className="hidden sm:inline-flex" />
            <span className={`size-2 shrink-0 rounded-full sm:hidden ${toneClasses[status.tone].dot}`} aria-label={status.label} />
          </li>
        )
      })}
    </ul>
  )
}
