import type { ServiceWithPreacher } from "@/lib/data/types"
import { serviceStatusMeta } from "@/lib/domain/labels"
import { toneClasses } from "@/lib/domain/tone"
import { serviceStatuses } from "@/lib/validation/service"
import { cn } from "@/lib/utils"

/** Resumo da escala do mês: % preenchida + contagem por status (legenda de cores). */
export function scheduleStats(services: Pick<ServiceWithPreacher, "status">[]) {
  const counts = Object.fromEntries(serviceStatuses.map((s) => [s, 0])) as Record<(typeof serviceStatuses)[number], number>
  for (const s of services) counts[s.status]++
  const active = services.length - counts.cancelado
  const filled = counts.confirmado + counts.realizado
  return { counts, active, filled, percent: active ? Math.round((filled / active) * 100) : 0 }
}

export function FillIndicator({ services }: { services: Pick<ServiceWithPreacher, "status">[] }) {
  const { counts, active, filled, percent } = scheduleStats(services)

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-baseline gap-2 sm:min-w-44">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{percent}%</span>
          <span className="text-sm text-muted-foreground">
            preenchida · {filled}/{active}
          </span>
        </div>
        <div className="flex-1 space-y-3">
          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Preenchimento da escala do mês"
          >
            {active > 0
              ? (["realizado", "confirmado", "convidado", "aberto"] as const).map((s) =>
                  counts[s] ? (
                    <div
                      key={s}
                      className={toneClasses[serviceStatusMeta[s].tone].dot}
                      style={{ width: `${(counts[s] / active) * 100}%` }}
                    />
                  ) : null
                )
              : null}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {serviceStatuses.map((s) => (
              <li key={s} className="flex items-center gap-1.5 text-muted-foreground">
                <span className={cn("size-2.5 rounded-full", toneClasses[serviceStatusMeta[s].tone].dot)} aria-hidden />
                {serviceStatusMeta[s].label}
                <span className="font-medium text-foreground tabular-nums">{counts[s]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
