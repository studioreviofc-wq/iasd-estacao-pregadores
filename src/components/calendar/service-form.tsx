"use client"

import { Ban, Link2Off, RotateCcw, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { deleteService, saveService, unlinkPreacher, updateServiceStatus } from "@/app/(app)/calendario/actions"
import { getRotationContext, type RotationContext } from "@/app/(app)/calendario/rotation-actions"
import { RotationConfirm } from "@/components/rotation/rotation-confirm"
import { RotationStatus, RotationSuggestions } from "@/components/rotation/rotation-suggestions"
import { Field, FormActions, FormAlert, SelectField, SubmitButton, type Option } from "@/components/forms/form-kit"
import { useFormAction } from "@/components/forms/use-form-action"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ActionState } from "@/lib/actions/state"
import type { AvailabilityWindow } from "@/lib/data/availabilities"
import type { PreacherOption } from "@/lib/data/preachers"
import type { ServiceWithPreacher } from "@/lib/data/types"
import { availablePreacherIds } from "@/lib/domain/availability"
import { preacherDisplayName } from "@/lib/domain/preacher-name"
import { suggestPreachers } from "@/lib/domain/rotation"
import { capitalize, formatDate } from "@/lib/domain/dates"
import { preacherCategoryLabel, serviceName, servicePeriodLabel, serviceStatusMeta } from "@/lib/domain/labels"
import { servicePeriods, serviceStatuses } from "@/lib/validation/service"

const statusOptions = serviceStatuses.map((s) => ({ value: s, label: serviceStatusMeta[s].label }))
const periodOptions = servicePeriods.map((p) => ({ value: p, label: servicePeriodLabel[p] }))

/** Cabeçalho do culto: data por extenso, período e status atual. */
export function ServiceSummary({ service }: { service: ServiceWithPreacher }) {
  const meta = serviceStatusMeta[service.status]
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
      <div>
        <p className="text-sm font-medium">
          {capitalize(formatDate(service.service_date, "EEEE, d 'de' MMMM 'de' yyyy"))}
        </p>
        <p className="text-xs text-muted-foreground">
          {serviceName(service)} · {servicePeriodLabel[service.period]}
        </p>
      </div>
      <StatusBadge tone={meta.tone} label={meta.label} />
    </div>
  )
}

/**
 * Formulário do culto (modal). Regulares: pregador, status, tema e observações.
 * Extraordinários: também data, período e nome; podem ser excluídos.
 */
export function ServiceForm({
  service,
  defaultDate,
  preachers,
  availability,
  onDone,
}: {
  service?: ServiceWithPreacher
  defaultDate?: string
  preachers: PreacherOption[]
  availability: AvailabilityWindow[]
  onDone: () => void
}) {
  const { state, pending, onSubmit, fieldError } = useFormAction(saveService, { onSuccess: onDone })
  const [quickPending, startQuick] = useTransition()
  const isSpecial = !service || service.service_type === "especial"
  const [date, setDate] = useState(service?.service_date ?? defaultDate ?? "")
  const [period, setPeriod] = useState<string>(service?.period ?? "noite")
  const [preacherId, setPreacherId] = useState(service?.preacher_id ?? "none")
  // Pregador ainda não cadastrado: digita o nome e ele é cadastrado ao salvar.
  const [typingNew, setTypingNew] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [rotation, setRotation] = useState<RotationContext | null>(null)
  const [loadingRotation, startRotation] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  // Dados de repetição relativos à data/período deste culto (consulta ao banco).
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    startRotation(async () => {
      setRotation(await getRotationContext({ date, period, serviceId: service?.id ?? null }))
    })
  }, [date, period, service?.id])

  const suggestions = useMemo(() => {
    if (!rotation || !date) return []
    const byId = new Map(rotation.snapshots.map((s) => [s.preacher_id, s]))
    return suggestPreachers(
      preachers
        .filter((p) => !p.archived_at)
        .map((p) => ({ preacher: { ...p, full_name: preacherDisplayName(p) }, snapshot: byId.get(p.id) })),
      availability,
      date,
      rotation.settings
    )
  }, [rotation, preachers, availability, date])

  const selected = suggestions.find((s) => s.preacherId === preacherId)
  const serverRotation = state.status === "error" ? state.rotation : undefined

  function confirmRotation() {
    if (confirmRef.current) confirmRef.current.value = "on"
    formRef.current?.requestSubmit()
  }

  const preacherOptions = useMemo<Option[]>(() => {
    const available = date ? availablePreacherIds(availability, date) : new Set<string>()
    const visible = preachers.filter((p) => p.is_active || p.id === service?.preacher_id)
    // Garante o pregador atual mesmo que não esteja na lista carregada.
    if (service?.preacher && !visible.some((p) => p.id === service.preacher!.id)) {
      visible.push({ ...service.preacher, nickname: null, home_church: null, is_active: false, archived_at: null, preferred_weekdays: [] })
    }
    const sorted = [...visible].sort(
      (a, b) => Number(available.has(b.id)) - Number(available.has(a.id)) || a.full_name.localeCompare(b.full_name)
    )
    return [
      { value: "none", label: "Sem pregador (em aberto)" },
      ...sorted.map((p) => ({
        value: p.id,
        label: preacherDisplayName(p),
        hint: available.has(p.id) ? "· disponível" : p.home_church ? `· ${p.home_church}` : `· ${preacherCategoryLabel[p.category]}`,
      })),
    ]
  }, [preachers, availability, date, service])

  const availableCount = preacherOptions.filter((o) => o.hint === "· disponível").length

  function quick(run: () => Promise<ActionState>) {
    startQuick(async () => {
      const result = await run()
      if (result.status === "success") {
        toast.success(result.message)
        onDone()
      } else if (result.status === "error") toast.error(result.message)
    })
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      <input ref={confirmRef} type="hidden" name="confirm_rotation" defaultValue="" />
      {service ? <input type="hidden" name="id" value={service.id} /> : null}
      {service ? <ServiceSummary service={service} /> : null}
      {serverRotation ? null : <FormAlert state={state} />}

      {isSpecial ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data" htmlFor="service_date" required error={fieldError("service_date")}>
              <Input id="service_date" name="service_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Período" htmlFor="period" required error={fieldError("period")}>
              <SelectField id="period" name="period" options={periodOptions} value={period} onValueChange={setPeriod} />
            </Field>
          </div>
          <Field label="Nome do culto" htmlFor="title" error={fieldError("title")}>
            <Input id="title" name="title" defaultValue={service?.title ?? ""} placeholder="Ex.: Semana de Oração, Santa Ceia" />
          </Field>
        </>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Pregador"
          htmlFor="preacher_id"
          error={fieldError("preacher_id")}
          hint={availableCount > 0 ? `${availableCount} com disponibilidade nesta data` : undefined}
        >
          {typingNew ? (
            <>
              <input type="hidden" name="preacher_id" value="none" />
              <Input
                id="new_preacher_name"
                name="new_preacher_name"
                placeholder="Nome ou apelido do pregador"
                autoFocus
                autoComplete="off"
                aria-invalid={Boolean(fieldError("preacher_id")) || undefined}
              />
            </>
          ) : (
            <SelectField
              id="preacher_id"
              name="preacher_id"
              options={preacherOptions}
              value={preacherId}
              onValueChange={setPreacherId}
              invalid={Boolean(fieldError("preacher_id"))}
            />
          )}
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setTypingNew((v) => !v)}
          >
            {typingNew ? "Escolher da lista de pregadores" : "Não está na lista? Digitar o nome"}
          </button>
        </Field>
        <Field label="Status" htmlFor="status" required error={fieldError("status")}>
          <SelectField id="status" name="status" options={statusOptions} defaultValue={service?.status ?? "aberto"} />
        </Field>
      </div>

      {typingNew ? (
        <Field
          label="Igreja do pregador"
          htmlFor="new_preacher_church"
          hint="Opcional. O pregador é cadastrado automaticamente ao salvar — telefone e apelido você completa depois em Pregadores."
        >
          <Input id="new_preacher_church" name="new_preacher_church" placeholder="Ex.: Central, Lagarto 3" autoComplete="off" />
        </Field>
      ) : null}

      {!typingNew && selected && preacherId !== "none" ? <RotationStatus assessment={selected.assessment} /> : null}
      {serverRotation ? <RotationConfirm rotation={serverRotation} onConfirm={confirmRotation} pending={pending} /> : null}

      {date ? (
        <RotationSuggestions
          suggestions={suggestions}
          loading={loadingRotation}
          ready={rotation !== null}
          error={rotation?.error}
          selectedId={typingNew ? "" : preacherId}
          onPick={(id) => {
            setTypingNew(false)
            setPreacherId(id)
          }}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field label="Tema da pregação" htmlFor="sermon_title" error={fieldError("sermon_title")}>
          <Input id="sermon_title" name="sermon_title" defaultValue={service?.sermon_title ?? ""} placeholder="Opcional" />
        </Field>
        <Field label="Horário" htmlFor="start_time" error={fieldError("start_time")}>
          <Input id="start_time" name="start_time" type="time" defaultValue={service?.start_time?.slice(0, 5) ?? ""} />
        </Field>
      </div>

      <Field label="Texto bíblico" htmlFor="bible_reference" error={fieldError("bible_reference")}>
        <Input id="bible_reference" name="bible_reference" defaultValue={service?.bible_reference ?? ""} placeholder="Opcional" />
      </Field>

      <Field label="Observações" htmlFor="notes" error={fieldError("notes")}>
        <Textarea id="notes" name="notes" rows={2} defaultValue={service?.notes ?? ""} />
      </Field>

      {service ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {service.preacher_id ? (
            <Button type="button" variant="outline" size="sm" disabled={quickPending} onClick={() => quick(() => unlinkPreacher(service.id))}>
              <Link2Off data-icon="inline-start" />
              Remover vínculo
            </Button>
          ) : null}
          {service.status === "cancelado" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={quickPending}
              onClick={() => quick(() => updateServiceStatus(service.id, service.preacher_id ? "convidado" : "aberto"))}
            >
              <RotateCcw data-icon="inline-start" />
              Reativar culto
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={quickPending}
              onClick={() => quick(() => updateServiceStatus(service.id, "cancelado"))}
            >
              <Ban data-icon="inline-start" />
              Cancelar culto
            </Button>
          )}
          {service.service_type === "especial" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={quickPending}
              onClick={() => (confirmDelete ? quick(() => deleteService(service.id)) : setConfirmDelete(true))}
            >
              <Trash2 data-icon="inline-start" />
              {confirmDelete ? "Confirmar exclusão" : "Excluir"}
            </Button>
          ) : null}
        </div>
      ) : null}

      <FormActions>
        <Button type="button" variant="outline" onClick={onDone}>
          Fechar
        </Button>
        <SubmitButton pending={pending}>{service ? "Salvar alterações" : "Criar culto"}</SubmitButton>
      </FormActions>
    </form>
  )
}
