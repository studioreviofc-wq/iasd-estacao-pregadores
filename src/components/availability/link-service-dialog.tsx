"use client"

import { CalendarCheck2 } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { linkAvailabilityToService } from "@/app/(app)/disponibilidades/actions"
import { FormDialog } from "@/components/forms/form-dialog"
import { FormActions } from "@/components/forms/form-kit"
import { RotationConfirm } from "@/components/rotation/rotation-confirm"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { ServiceOption } from "@/lib/data/services"
import { availabilityCovers } from "@/lib/domain/availability"
import { availableDaysLabel } from "@/lib/domain/availability-format"
import { capitalize, formatDate } from "@/lib/domain/dates"
import { serviceName, servicePeriodLabel, serviceStatusMeta } from "@/lib/domain/labels"
import { cn } from "@/lib/utils"
import type { AvailabilityOverviewRow } from "@/types/database"

/**
 * Vincula o pregador de uma disponibilidade a um culto compatível.
 * A escolha do status é explícita — disponibilidade não vira confirmação sozinha.
 */
export function LinkServiceDialog({
  availability,
  services,
  onClose,
}: {
  availability: AvailabilityOverviewRow | null
  services: ServiceOption[]
  onClose: () => void
}) {
  return (
    <FormDialog
      open={availability !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Vincular a uma data de culto"
      description={
        availability
          ? `${availability.preacher_name} · ${capitalize(formatDate(availability.availability_month, "MMMM 'de' yyyy"))} · ${availableDaysLabel(availability)}`
          : undefined
      }
    >
      {availability ? <LinkServiceForm availability={availability} services={services} onClose={onClose} /> : null}
    </FormDialog>
  )
}

function LinkServiceForm({
  availability,
  services,
  onClose,
}: {
  availability: AvailabilityOverviewRow
  services: ServiceOption[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [rotation, setRotation] = useState<{ status: "convidado" | "confirmado"; info: { preacher: string; warnings: string[] } } | null>(null)

  const candidates = services.filter(
    (s) =>
      availabilityCovers(availability, s.service_date) &&
      (s.status === "aberto" || s.status === "convidado" || (s.status === "confirmado" && s.preacher_id === availability.preacher_id))
  )

  function submit(status: "convidado" | "confirmado", confirmRotation = false) {
    if (!selected) return
    startTransition(async () => {
      const result = await linkAvailabilityToService(availability.id, selected, status, confirmRotation)
      if (result.status === "success") {
        toast.success(result.message)
        onClose()
      } else if (result.status === "error" && result.rotation) {
        setRotation({ status, info: result.rotation })
      } else if (result.status === "error") toast.error(result.message)
    })
  }

  if (candidates.length === 0) {
    return (
      <EmptyState
        compact
        icon={CalendarCheck2}
        title="Nenhum culto compatível"
        description="Não há cultos em aberto nas datas e dias informados nesta disponibilidade."
      />
    )
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <Label asChild>
          <legend>Cultos compatíveis com a disponibilidade</legend>
        </Label>
        <ul className="max-h-72 space-y-1.5 overflow-y-auto" role="radiogroup">
          {candidates.map((s) => {
            const meta = serviceStatusMeta[s.status]
            const active = selected === s.id
            return (
              <li key={s.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setSelected(s.id)
                    setRotation(null)
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                    active && "border-primary bg-accent ring-1 ring-primary"
                  )}
                >
                  <span>
                    <span className="font-medium">{capitalize(formatDate(s.service_date, "EEEE, dd/MM"))}</span>
                    <span className="block text-xs text-muted-foreground">
                      {servicePeriodLabel[s.period]}
                      {s.service_type === "especial" ? ` · ${serviceName(s)}` : ""}
                    </span>
                  </span>
                  <StatusBadge tone={meta.tone} label={meta.short} />
                </button>
              </li>
            )
          })}
        </ul>
      </fieldset>
      {rotation ? (
        <RotationConfirm rotation={rotation.info} pending={pending} onConfirm={() => submit(rotation.status, true)} />
      ) : null}
      <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Escolha “Aguardando confirmação” se ainda vai confirmar com o pregador. A disponibilidade é atualizada e o histórico preservado.
      </p>
      <FormActions>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" variant="outline" disabled={!selected || pending} onClick={() => submit("convidado")}>
          Aguardando confirmação
        </Button>
        <Button type="button" disabled={!selected || pending} onClick={() => submit("confirmado")}>
          Confirmar escala
        </Button>
      </FormActions>
    </div>
  )
}
