import { UserCheck } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { availableDaysLabel } from "@/lib/domain/availability-format"
import { availabilityStatusMeta } from "@/lib/domain/labels"
import type { AvailabilityOverviewRow } from "@/types/database"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

export function AvailablePreachers({ items }: { items: AvailabilityOverviewRow[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        compact
        icon={UserCheck}
        title="Nenhuma disponibilidade informada"
        description="Quem responder “Disponível em outro mês” aparece aqui."
      />
    )
  }

  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-brand-50 text-xs font-medium text-brand-600">{initials(a.preacher_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <Link href={`/pregadores/${a.preacher_id}`} className="block truncate text-sm font-medium hover:text-primary">
              {a.preacher_name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{availableDaysLabel(a)}</p>
          </div>
          {a.effective_status === "aguardando_confirmacao" ? (
            <StatusBadge tone="warning" label="Aguardando" title={availabilityStatusMeta.aguardando_confirmacao.label} />
          ) : null}
        </li>
      ))}
    </ul>
  )
}
