"use client"

import { CalendarClock, Link2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { LinkServiceDialog } from "@/components/availability/link-service-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { WhatsappButton, type WhatsappContext } from "@/components/whatsapp/whatsapp-dialog"
import type { ServiceOption } from "@/lib/data/services"
import { availableDaysLabel } from "@/lib/domain/availability-format"
import { capitalize, formatDate } from "@/lib/domain/dates"
import { availabilityStatusMeta } from "@/lib/domain/labels"
import type { AvailabilityOverviewRow } from "@/types/database"

/** Pregadores que sinalizaram disponibilidade para o mês exibido no calendário. */
export function MonthAvailabilityPanel({
  monthLabel,
  items,
  services,
  canEdit,
  whatsapp,
}: {
  monthLabel: string
  items: AvailabilityOverviewRow[]
  services: ServiceOption[]
  canEdit: boolean
  whatsapp: WhatsappContext
}) {
  const [linking, setLinking] = useState<AvailabilityOverviewRow | null>(null)

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card" aria-label="Disponíveis no mês">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="size-4 text-brand-600" />
          Disponíveis em {capitalize(monthLabel)}
          <span className="font-normal text-muted-foreground">({items.length})</span>
        </h2>
        <Link href="/disponibilidades" className="text-xs font-medium text-primary hover:underline">
          Ver todas as disponibilidades
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pregador sinalizou disponibilidade para este mês.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <div className="min-w-0 flex-1">
                <Link href={`/pregadores/${a.preacher_id}`} className="block truncate text-sm font-medium hover:text-primary">
                  {a.preacher_name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {availableDaysLabel(a)}
                  {a.last_preached_on ? ` · pregou em ${formatDate(a.last_preached_on, "dd/MM/yy")}` : " · nunca pregou"}
                </p>
                {a.effective_status === "aguardando_confirmacao" ? (
                  <StatusBadge tone="warning" label={availabilityStatusMeta.aguardando_confirmacao.label} className="mt-1" />
                ) : null}
              </div>
              <WhatsappButton
                preacher={{ full_name: a.preacher_name, phone: a.preacher_phone, whatsapp: a.preacher_whatsapp }}
                context={whatsapp}
              />
              {canEdit ? (
                <Button size="sm" variant="outline" onClick={() => setLinking(a)}>
                  <Link2 data-icon="inline-start" />
                  Escalar
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <LinkServiceDialog availability={linking} services={services} onClose={() => setLinking(null)} />
    </section>
  )
}
