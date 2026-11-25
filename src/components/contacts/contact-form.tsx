"use client"

import { useRef, useState } from "react"

import { saveContact } from "@/app/(app)/contatos/actions"
import { AvailabilityFields, type MonthOption } from "@/components/availability/availability-fields"
import { Field, FormActions, FormAlert, SelectField, SubmitButton } from "@/components/forms/form-kit"
import { PreacherSelect } from "@/components/forms/preacher-select"
import { RotationConfirm } from "@/components/rotation/rotation-confirm"
import { useFormAction } from "@/components/forms/use-form-action"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { PreacherOption } from "@/lib/data/preachers"
import type { ServiceOption } from "@/lib/data/services"
import { formatDate } from "@/lib/domain/dates"
import { contactChannelLabel, contactOutcomeMeta, serviceName, servicePeriodLabel, serviceStatusMeta } from "@/lib/domain/labels"
import { contactChannels, contactOutcomes } from "@/lib/validation/contact"
import type { ContactLogRow } from "@/types/database"

const channelOptions = contactChannels.map((c) => ({ value: c, label: contactChannelLabel[c] }))
const outcomeOptions = contactOutcomes.map((o) => ({ value: o, label: contactOutcomeMeta[o].label }))

export type ContactFormPrefill = {
  preacherId?: string
  previous?: Pick<ContactLogRow, "id" | "invited_for_month" | "service_id" | "channel">
}

/**
 * Registro de uma interação com o pregador. Sempre cria um novo registro —
 * quando vem de "Nova interação", fica ligado ao contato anterior.
 */
export function ContactForm({
  prefill,
  preachers,
  services,
  monthOptions,
  today,
  onDone,
}: {
  prefill?: ContactFormPrefill
  preachers: PreacherOption[]
  services: ServiceOption[]
  monthOptions: MonthOption[]
  today: string
  onDone: () => void
}) {
  const { state, pending, onSubmit, fieldError } = useFormAction(saveContact, { onSuccess: onDone })
  const formRef = useRef<HTMLFormElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)
  const serverRotation = state.status === "error" ? state.rotation : undefined
  const prev = prefill?.previous
  const [target, setTarget] = useState<"mes" | "culto" | "nenhum">(prev?.service_id ? "culto" : prev && !prev.invited_for_month ? "nenhum" : "mes")
  const [outcome, setOutcome] = useState<string>("aguardando")

  const serviceOptions = services.map((s) => ({
    value: s.id,
    label: `${formatDate(s.service_date, "EEE dd/MM")} · ${servicePeriodLabel[s.period]}${s.service_type === "especial" ? ` · ${serviceName(s)}` : ""}`,
    hint: `· ${serviceStatusMeta[s.status].short}`,
  }))
  const monthSelect = monthOptions.map((m) => ({ value: m.key, label: m.label }))

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      <input ref={confirmRef} type="hidden" name="confirm_rotation" defaultValue="" />
      {prev ? <input type="hidden" name="previous_id" value={prev.id} /> : null}
      <input type="hidden" name="target" value={target} />
      {serverRotation ? (
        <RotationConfirm
          rotation={serverRotation}
          pending={pending}
          onConfirm={() => {
            if (confirmRef.current) confirmRef.current.value = "on"
            formRef.current?.requestSubmit()
          }}
        />
      ) : (
        <FormAlert state={state} />
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <Field label="Pregador" htmlFor="preacher_id" required error={fieldError("preacher_id")}>
          <PreacherSelect preachers={preachers} defaultValue={prefill?.preacherId} invalid={Boolean(fieldError("preacher_id"))} />
        </Field>
        <Field label="Data do contato" htmlFor="contacted_on" required error={fieldError("contacted_on")}>
          <Input id="contacted_on" name="contacted_on" type="date" max={today} defaultValue={today} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Meio de contato" htmlFor="channel" required error={fieldError("channel")}>
          <SelectField id="channel" name="channel" options={channelOptions} defaultValue={prev?.channel && prev.channel !== "email" ? prev.channel : "whatsapp"} />
        </Field>
        <Field label="Resposta recebida" htmlFor="outcome" required error={fieldError("outcome")}>
          <SelectField id="outcome" name="outcome" options={outcomeOptions} value={outcome} onValueChange={setOutcome} />
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Convidado para</p>
        <Tabs value={target} onValueChange={(v) => setTarget(v as typeof target)}>
          <TabsList>
            <TabsTrigger value="mes">Um mês</TabsTrigger>
            <TabsTrigger value="culto">Uma data de culto</TabsTrigger>
            <TabsTrigger value="nenhum">Sem data definida</TabsTrigger>
          </TabsList>
        </Tabs>
        {target === "mes" ? (
          <Field label="Mês" htmlFor="invited_for_month" error={fieldError("invited_for_month")} className="sm:max-w-64">
            <SelectField
              id="invited_for_month"
              name="invited_for_month"
              options={monthSelect}
              defaultValue={prev?.invited_for_month?.slice(0, 7) ?? monthOptions[0]?.key}
              placeholder="Selecione o mês"
            />
          </Field>
        ) : target === "culto" ? (
          <Field
            label="Culto"
            htmlFor="service_id"
            error={fieldError("service_id")}
            hint="Aceito confirma o pregador neste culto; aguardando deixa o culto aguardando confirmação."
          >
            <SelectField
              id="service_id"
              name="service_id"
              options={serviceOptions}
              defaultValue={prev?.service_id ?? undefined}
              placeholder={serviceOptions.length ? "Selecione o culto" : "Nenhum culto futuro disponível"}
            />
          </Field>
        ) : null}
      </div>

      {outcome === "outro_mes" ? (
        <AvailabilityFields monthOptions={monthOptions} fieldError={fieldError} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <Field label="Observações" htmlFor="notes" error={fieldError("notes")}>
          <Textarea id="notes" name="notes" rows={2} />
        </Field>
        <Field label="Data sugerida para novo contato" htmlFor="follow_up_on" error={fieldError("follow_up_on")}>
          <Input id="follow_up_on" name="follow_up_on" type="date" min={today} />
        </Field>
      </div>

      <FormActions>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton pending={pending}>Registrar contato</SubmitButton>
      </FormActions>
    </form>
  )
}
