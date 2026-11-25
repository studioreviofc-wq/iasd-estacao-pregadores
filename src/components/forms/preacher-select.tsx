"use client"

import type { PreacherOption } from "@/lib/data/preachers"
import { preacherCategoryLabel } from "@/lib/domain/labels"

import { SelectField } from "./form-kit"

/** Select de pregadores ativos (mantém o atual mesmo se inativo). */
export function PreacherSelect({
  preachers,
  defaultValue,
  invalid,
  id = "preacher_id",
}: {
  preachers: PreacherOption[]
  defaultValue?: string
  invalid?: boolean
  id?: string
}) {
  const options = preachers
    .filter((p) => p.is_active || p.id === defaultValue)
    .map((p) => ({ value: p.id, label: p.full_name, hint: `· ${preacherCategoryLabel[p.category]}` }))
  return (
    <SelectField
      id={id}
      name="preacher_id"
      options={options}
      defaultValue={defaultValue}
      placeholder={options.length ? "Selecione o pregador" : "Cadastre um pregador primeiro"}
      invalid={invalid}
    />
  )
}
