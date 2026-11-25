"use client"

import { eachDayOfInterval, endOfMonth, endOfWeek, isSameMonth, startOfMonth, startOfWeek } from "date-fns"
import { Plus } from "lucide-react"

import type { ServiceWithPreacher } from "@/lib/data/types"
import { fromISODate, toISODate } from "@/lib/domain/dates"
import { serviceStatusMeta, servicePeriodLabel } from "@/lib/domain/labels"
import { toneClasses } from "@/lib/domain/tone"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const PREACHING_DAYS = new Set([0, 3, 6])

/** Grade mensal da escala (desktop). */
export function MonthCalendar({
  monthStart,
  services,
  today,
  onSelect,
  onCreate,
}: {
  monthStart: string
  services: ServiceWithPreacher[]
  today: string
  onSelect?: (service: ServiceWithPreacher) => void
  onCreate?: (date: string) => void
}) {
  const monthDate = fromISODate(monthStart)
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(monthDate)),
    end: endOfWeek(endOfMonth(monthDate)),
  })

  const byDate = new Map<string, ServiceWithPreacher[]>()
  for (const s of services) byDate.set(s.service_date, [...(byDate.get(s.service_date) ?? []), s])

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              "px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase",
              PREACHING_DAYS.has(i) && "text-brand-600"
            )}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const iso = toISODate(day)
          const inMonth = isSameMonth(day, monthDate)
          const items = inMonth ? (byDate.get(iso) ?? []) : []
          return (
            <div
              key={iso}
              className={cn(
                "group/day relative min-h-30 border-border p-2",
                i % 7 !== 6 && "border-r",
                i < days.length - 7 && "border-b",
                !inMonth && "bg-muted/40",
                inMonth && PREACHING_DAYS.has(day.getDay()) && "bg-brand-50/40"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                    !inMonth && "text-muted-foreground/50",
                    iso === today && "bg-primary font-semibold text-primary-foreground"
                  )}
                >
                  {day.getDate()}
                </span>
                {onCreate && inMonth ? (
                  <button
                    type="button"
                    onClick={() => onCreate(iso)}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/day:opacity-100 hover:bg-accent hover:text-accent-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label={`Criar culto extraordinário em ${day.getDate()}`}
                    title="Culto extraordinário"
                  >
                    <Plus className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="mt-1 space-y-1">
                {items.map((s) => {
                  const meta = serviceStatusMeta[s.status]
                  const tone = toneClasses[meta.tone]
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => onSelect?.(s)}
                      disabled={!onSelect}
                      className={cn(
                        "block w-full rounded-md border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight transition-shadow enabled:hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        tone.soft,
                        tone.bar
                      )}
                      title={`${servicePeriodLabel[s.period]} · ${meta.label}`}
                    >
                      <span className={cn("block truncate font-medium", s.status === "cancelado" && "line-through")}>
                        {s.preacher?.full_name ?? (s.status === "cancelado" ? "Cancelado" : "Em aberto")}
                      </span>
                      <span className="block truncate opacity-80">
                        {servicePeriodLabel[s.period]}
                        {s.service_type === "especial" ? ` · ${s.title ?? "Extraordinário"}` : ""}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
