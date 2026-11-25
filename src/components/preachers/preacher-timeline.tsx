"use client"

import { CalendarClock, History, Mic, PhoneCall, Rows3 } from "lucide-react"
import { useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toneClasses } from "@/lib/domain/tone"
import type { TimelineItem, TimelineKind } from "@/lib/domain/timeline"
import { cn } from "@/lib/utils"

const kindIcon = { pregacao: Mic, escala: Rows3, convite: PhoneCall, disponibilidade: CalendarClock } as const

const filters: { value: "todos" | TimelineKind; label: string }[] = [
  { value: "todos", label: "Tudo" },
  { value: "pregacao", label: "Pregações" },
  { value: "escala", label: "Escala" },
  { value: "convite", label: "Convites" },
  { value: "disponibilidade", label: "Disponibilidades" },
]

export function PreacherTimeline({ items }: { items: TimelineItem[] }) {
  const [filter, setFilter] = useState<"todos" | TimelineKind>("todos")
  const visible = filter === "todos" ? items : items.filter((i) => i.kind === filter)

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="h-auto flex-wrap">
          {filters.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
              <span className="ml-1 text-xs text-muted-foreground tabular-nums">
                {f.value === "todos" ? items.length : items.filter((i) => i.kind === f.value).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <EmptyState compact icon={History} title="Nada registrado ainda" description="Pregações, convites e mudanças na escala aparecem aqui automaticamente." />
      ) : (
        <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-border">
          {visible.map((item) => {
            const Icon = kindIcon[item.kind]
            return (
              <li key={item.id} className="relative flex gap-3">
                <span
                  className={cn(
                    "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
                    toneClasses[item.tone].icon
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-medium">{item.title}</p>
                    <time className="text-xs text-muted-foreground tabular-nums">{item.dateLabel}</time>
                  </div>
                  {item.detail ? <p className="text-sm text-muted-foreground">{item.detail}</p> : null}
                  {item.badge ? <StatusBadge tone={item.badge.tone} label={item.badge.label} className="mt-1.5" /> : null}
                  {item.note ? (
                    <p className="mt-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">“{item.note}”</p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
