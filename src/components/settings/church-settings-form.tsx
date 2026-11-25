"use client"

import { saveChurchSettings } from "@/app/(app)/configuracoes/actions"
import { Field, FormAlert, SubmitButton } from "@/components/forms/form-kit"
import { useFormAction } from "@/components/forms/use-form-action"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { serviceTypeLabel } from "@/lib/domain/labels"
import { serviceTypes, serviceTypeWeekday } from "@/lib/validation/service"
import type { ChurchSettingsRow } from "@/types/database"

const recurring = serviceTypes.filter((t) => serviceTypeWeekday[t] !== undefined)

export function ChurchSettingsForm({ settings, canEdit }: { settings: ChurchSettingsRow | null; canEdit: boolean }) {
  const { state, pending, onSubmit, fieldError } = useFormAction(saveChurchSettings)

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormAlert state={state} />
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field label="Nome da igreja" htmlFor="church_name" required error={fieldError("church_name")}>
          <Input
            id="church_name"
            name="church_name"
            defaultValue={settings?.church_name ?? "Igreja Adventista do Sétimo Dia da Estação"}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Distrito" htmlFor="district" error={fieldError("district")}>
            <Input id="district" name="district" defaultValue={settings?.district ?? ""} />
          </Field>
          <Field label="Cidade" htmlFor="city" error={fieldError("city")}>
            <Input id="city" name="city" defaultValue={settings?.city ?? ""} />
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Cultos regulares</legend>
          <p className="text-xs text-muted-foreground">Dias de pregação gerados automaticamente em todo o período do calendário.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {recurring.map((t) => (
              <div key={t} className="flex items-center gap-2">
                <Checkbox
                  id={`dst-${t}`}
                  name="default_service_types"
                  value={t}
                  defaultChecked={(settings?.default_service_types ?? ["sabado_manha", "quarta_noite", "domingo_noite"]).includes(t)}
                />
                <Label htmlFor={`dst-${t}`} className="font-normal">
                  {serviceTypeLabel[t]}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Período do calendário</legend>
          <p className="text-xs text-muted-foreground">
            Meses disponíveis na escala. Ao ampliar, os cultos regulares do novo período são criados automaticamente.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Primeiro mês" htmlFor="schedule_start" required error={fieldError("schedule_start")}>
              <Input
                id="schedule_start"
                name="schedule_start"
                type="month"
                placeholder="aaaa-mm"
                defaultValue={(settings?.schedule_start ?? "2026-12-01").slice(0, 7)}
              />
            </Field>
            <Field label="Último mês" htmlFor="schedule_end" required error={fieldError("schedule_end")}>
              <Input
                id="schedule_end"
                name="schedule_end"
                type="month"
                placeholder="aaaa-mm"
                defaultValue={(settings?.schedule_end ?? "2027-12-31").slice(0, 7)}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-medium">Rotatividade de pregadores</legend>
          <Field
            label="Intervalo mínimo recomendado (dias)"
            htmlFor="min_interval_days"
            error={fieldError("min_interval_days")}
            hint="Escalar alguém com menos dias desde a última pregação gera alerta e pede confirmação."
            className="sm:max-w-72"
          >
            <Input id="min_interval_days" name="min_interval_days" type="number" min={0} max={365} defaultValue={settings?.min_interval_days ?? 30} />
          </Field>
          <div className="flex items-start gap-2">
            <Checkbox
              id="consecutive_month_alert"
              name="consecutive_month_alert"
              defaultChecked={settings?.consecutive_month_alert ?? true}
              className="mt-0.5"
            />
            <Label htmlFor="consecutive_month_alert" className="font-normal leading-snug">
              Alertar quando o pregador pregou ou está confirmado no mês anterior (meses consecutivos)
            </Label>
          </div>
        </fieldset>

        <Field
          label="Mensagem padrão do WhatsApp"
          htmlFor="whatsapp_template"
          required
          error={fieldError("whatsapp_template")}
          hint="Variáveis: {nome}, {primeiro_nome}, {igreja}. A mensagem pode ser editada antes de abrir o WhatsApp."
        >
          <Textarea
            id="whatsapp_template"
            name="whatsapp_template"
            rows={4}
            defaultValue={
              settings?.whatsapp_template ??
              "Olá, {primeiro_nome}! Tudo bem? Aqui é da secretaria da {igreja}. Gostaríamos de conversar com você sobre a escala de pregações. Você teria disponibilidade?"
            }
          />
        </Field>

        <Field
          label="Antecedência dos convites (dias)"
          htmlFor="invite_lead_days"
          error={fieldError("invite_lead_days")}
          hint="Quantos dias antes do culto o convite deve ser feito."
          className="sm:max-w-56"
        >
          <Input
            id="invite_lead_days"
            name="invite_lead_days"
            type="number"
            min={0}
            max={365}
            defaultValue={settings?.invite_lead_days ?? 30}
          />
        </Field>
      </fieldset>

      {canEdit ? (
        <div className="flex justify-end">
          <SubmitButton pending={pending}>Salvar configurações</SubmitButton>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Somente administradores podem alterar estes dados.</p>
      )}
    </form>
  )
}
