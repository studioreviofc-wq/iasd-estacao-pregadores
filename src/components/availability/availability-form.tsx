"use client"

import { saveAvailability } from "@/app/(app)/disponibilidades/actions"
import { Field, FormActions, FormAlert, SubmitButton } from "@/components/forms/form-kit"
import { PreacherSelect } from "@/components/forms/preacher-select"
import { useFormAction } from "@/components/forms/use-form-action"
import { Button } from "@/components/ui/button"
import type { PreacherOption } from "@/lib/data/preachers"
import type { AvailabilityRow } from "@/types/database"

import { AvailabilityFields, type MonthOption } from "./availability-fields"

export function AvailabilityForm({
  availability,
  preachers,
  monthOptions,
  onDone,
}: {
  availability?: AvailabilityRow
  preachers: PreacherOption[]
  monthOptions: MonthOption[]
  onDone: () => void
}) {
  const { state, pending, onSubmit, fieldError } = useFormAction(saveAvailability, { onSuccess: onDone })
  const month = availability?.availability_month.slice(0, 7)
  const options = month && !monthOptions.some((m) => m.key === month) ? [{ key: month, label: month }, ...monthOptions] : monthOptions

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {availability ? <input type="hidden" name="id" value={availability.id} /> : null}
      <FormAlert state={state} />
      <Field label="Pregador" htmlFor="preacher_id" required error={fieldError("preacher_id")}>
        <PreacherSelect preachers={preachers} defaultValue={availability?.preacher_id} invalid={Boolean(fieldError("preacher_id"))} />
      </Field>
      <AvailabilityFields
        monthOptions={options}
        fieldError={fieldError}
        singleMonth={Boolean(availability)}
        defaults={
          availability
            ? {
                months: [availability.availability_month.slice(0, 7)],
                dates: availability.specific_dates,
                weekdays: availability.weekdays,
                notes: availability.notes,
                followUp: availability.follow_up_on,
              }
            : undefined
        }
      />
      <FormActions>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton pending={pending}>{availability ? "Salvar alterações" : "Registrar disponibilidade"}</SubmitButton>
      </FormActions>
    </form>
  )
}
