"use client"

import { Plus, X } from "lucide-react"
import { useState } from "react"

import { Field } from "@/components/forms/form-kit"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { WEEKDAYS } from "@/lib/domain/weekdays"
import { cn } from "@/lib/utils"

export type MonthOption = { key: string; label: string }

const chip =
  "flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:text-accent-foreground"

/**
 * Campos da disponibilidade futura: meses (vários), datas específicas,
 * dias da semana, observações e data para novo contato.
 * Enviados como av_months[], av_dates[], av_weekdays[], av_notes, av_follow_up_on.
 */
export function AvailabilityFields({
  monthOptions,
  fieldError,
  defaults,
  singleMonth = false,
}: {
  monthOptions: MonthOption[]
  fieldError: (name: string) => string | undefined
  defaults?: { months?: string[]; dates?: string[]; weekdays?: number[]; notes?: string | null; followUp?: string | null }
  singleMonth?: boolean
}) {
  const [months, setMonths] = useState<string[]>(defaults?.months ?? [])
  const [dates, setDates] = useState<string[]>(defaults?.dates ?? [])

  function toggleMonth(key: string, checked: boolean) {
    setMonths((prev) => (singleMonth ? (checked ? [key] : []) : checked ? [...prev, key] : prev.filter((m) => m !== key)))
  }

  const sortedMonths = [...months].sort()
  const minDate = sortedMonths[0] ? `${sortedMonths[0]}-01` : undefined
  const maxDate = sortedMonths.at(-1) ? `${sortedMonths.at(-1)}-31` : undefined

  return (
    <div className="space-y-4 rounded-lg border border-brand-500/30 bg-brand-50/50 p-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          {singleMonth ? "Mês de disponibilidade" : "Meses de disponibilidade"}
          <span className="text-destructive">*</span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {monthOptions.map((m) => (
            <label key={m.key} className={cn(chip, "bg-card")}>
              <Checkbox
                name="av_months"
                value={m.key}
                checked={months.includes(m.key)}
                onCheckedChange={(c) => toggleMonth(m.key, c === true)}
                className="size-3.5"
              />
              {m.label}
            </label>
          ))}
        </div>
        {fieldError("av_months") ? <p className="text-xs text-destructive">{fieldError("av_months")}</p> : null}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Datas específicas</legend>
        <p className="text-xs text-muted-foreground">Opcional. Sem datas, vale para todo o mês (respeitando os dias da semana).</p>
        <div className="flex flex-wrap items-center gap-2">
          {dates.map((d, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                type="date"
                name="av_dates"
                value={d}
                min={minDate}
                max={maxDate}
                onChange={(e) => setDates((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                className="h-8 w-40 bg-card"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Remover data"
                onClick={() => setDates((prev) => prev.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setDates((prev) => [...prev, ""])} disabled={!months.length}>
            <Plus data-icon="inline-start" />
            Adicionar data
          </Button>
        </div>
        {fieldError("av_dates") ? <p className="text-xs text-destructive">{fieldError("av_dates")}</p> : null}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Dias da semana disponíveis</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => (
            <label key={d.value} className={cn(chip, "bg-card")}>
              <Checkbox name="av_weekdays" value={String(d.value)} defaultChecked={defaults?.weekdays?.includes(d.value)} className="size-3.5" />
              {d.short}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Nenhum marcado = qualquer dia.</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <Field label="Observações da disponibilidade" htmlFor="av_notes" error={fieldError("av_notes")}>
          <Textarea id="av_notes" name="av_notes" rows={2} defaultValue={defaults?.notes ?? ""} className="bg-card" />
        </Field>
        <Field label="Novo contato em" htmlFor="av_follow_up_on" error={fieldError("av_follow_up_on")}>
          <Input id="av_follow_up_on" name="av_follow_up_on" type="date" defaultValue={defaults?.followUp ?? ""} className="bg-card" />
        </Field>
      </div>
    </div>
  )
}
