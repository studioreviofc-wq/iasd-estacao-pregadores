"use client"

import { CalendarDays, ChevronRight } from "lucide-react"

import { DateBlock } from "@/components/dashboard/service-list"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { TableCard } from "@/components/shared/table-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ServiceWithPreacher } from "@/lib/data/types"
import { formatDate, weekdayOf } from "@/lib/domain/dates"
import { serviceName, servicePeriodLabel, serviceStatusMeta } from "@/lib/domain/labels"
import { toneClasses } from "@/lib/domain/tone"
import { cn } from "@/lib/utils"

/** Visualização em lista da escala (tabela no desktop, cartões no mobile). */
export function ScheduleList({
  services,
  onSelect,
  emptyMessage,
}: {
  services: ServiceWithPreacher[]
  onSelect?: (service: ServiceWithPreacher) => void
  emptyMessage: string
}) {
  if (services.length === 0) {
    return <EmptyState icon={CalendarDays} title="Nenhum culto encontrado" description={emptyMessage} className="bg-card" compact />
  }

  return (
    <>
      <div className="hidden md:block">
        <TableCard footer={`${services.length} ${services.length === 1 ? "culto" : "cultos"}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Dia da semana</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Pregador</TableHead>
                <TableHead>Tema</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => {
                const meta = serviceStatusMeta[s.status]
                return (
                  <TableRow
                    key={s.id}
                    onClick={() => onSelect?.(s)}
                    className={cn(onSelect && "cursor-pointer", "border-l-[3px]", toneClasses[meta.tone].bar)}
                  >
                    <TableCell className="font-medium tabular-nums">{formatDate(s.service_date, "dd/MM/yyyy")}</TableCell>
                    <TableCell>{weekdayOf(s.service_date)}</TableCell>
                    <TableCell>
                      {servicePeriodLabel[s.period]}
                      {s.service_type === "especial" ? (
                        <span className="block text-xs text-muted-foreground">{serviceName(s)}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className={cn(!s.preacher && "text-muted-foreground")}>
                      {s.preacher ? (
                        <button
                          type="button"
                          className="text-left font-medium hover:text-primary focus-visible:underline focus-visible:outline-none"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelect?.(s)
                          }}
                        >
                          {s.preacher.full_name}
                        </button>
                      ) : (
                        "A definir"
                      )}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">{s.sermon_title ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge tone={meta.tone} label={meta.label} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableCard>
      </div>

      <ul className="space-y-2 md:hidden">
        {services.map((s) => {
          const meta = serviceStatusMeta[s.status]
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect?.(s)}
                disabled={!onSelect}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border border-l-[3px] border-border bg-card p-3 text-left shadow-card",
                  toneClasses[meta.tone].bar
                )}
              >
                <DateBlock date={s.service_date} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm font-medium", !s.preacher && "text-muted-foreground")}>
                    {s.preacher?.full_name ?? "Pregador a definir"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {weekdayOf(s.service_date)} · {servicePeriodLabel[s.period]}
                    {s.service_type === "especial" ? ` · ${serviceName(s)}` : ""}
                  </span>
                  <StatusBadge tone={meta.tone} label={meta.short} className="mt-1.5" />
                </span>
                {onSelect ? <ChevronRight className="size-4 text-muted-foreground" /> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
