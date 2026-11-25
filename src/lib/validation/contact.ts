import { z } from "zod"

import { isoDate, optionalDate, optionalId, optionalText, requiredId } from "./fields"

/** Meios de contato oferecidos no formulário (o banco ainda aceita "email" de registros antigos). */
export const contactChannels = ["whatsapp", "telefone", "presencial", "outro"] as const
export const contactOutcomes = ["nao_contatado", "aguardando", "aceito", "indisponivel", "outro_mes", "novo_contato"] as const

const monthKey = z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido.")
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
const weekday = z.coerce.number().int().min(0).max(6)

/** Bloco de disponibilidade futura (usado no contato "Disponível em outro mês" e no cadastro direto). */
export const availabilityFields = {
  av_months: z.array(monthKey).default([]),
  av_dates: z.array(dateKey).default([]),
  av_weekdays: z.array(weekday).default([]),
  av_notes: optionalText(500),
  av_follow_up_on: optionalDate,
}

export const contactSchema = z
  .object({
    previous_id: optionalId,
    preacher_id: requiredId("o pregador"),
    channel: z.enum(contactChannels, { error: "Selecione o meio de contato." }),
    outcome: z.enum(contactOutcomes, { error: "Selecione a resposta." }),
    contacted_on: isoDate("a data do contato"),
    target: z.enum(["mes", "culto", "nenhum"]).default("mes"),
    invited_for_month: z
      .string()
      .optional()
      .transform((v) => v || null),
    service_id: optionalId,
    follow_up_on: optionalDate,
    notes: optionalText(1000),
    ...availabilityFields,
  })
  .superRefine((v, ctx) => {
    if (v.target === "mes" && !v.invited_for_month) {
      ctx.addIssue({ code: "custom", path: ["invited_for_month"], message: "Informe o mês do convite." })
    }
    if (v.target === "culto" && !v.service_id) {
      ctx.addIssue({ code: "custom", path: ["service_id"], message: "Selecione o culto." })
    }
    if (v.follow_up_on && v.follow_up_on < v.contacted_on) {
      ctx.addIssue({ code: "custom", path: ["follow_up_on"], message: "O novo contato deve ser após o contato atual." })
    }
    if (v.outcome === "outro_mes") {
      if (!v.av_months.length) {
        ctx.addIssue({ code: "custom", path: ["av_months"], message: "Selecione ao menos um mês de disponibilidade." })
      }
      const bad = v.av_dates.find((d) => !v.av_months.includes(d.slice(0, 7)))
      if (bad) ctx.addIssue({ code: "custom", path: ["av_dates"], message: "Cada data deve estar em um dos meses selecionados." })
    }
  })

export const availabilityStatusesManual = ["informada", "aguardando_confirmacao", "indisponivel"] as const

export const availabilitySchema = z
  .object({
    id: optionalId,
    preacher_id: requiredId("o pregador"),
    ...availabilityFields,
  })
  .superRefine((v, ctx) => {
    if (!v.av_months.length) ctx.addIssue({ code: "custom", path: ["av_months"], message: "Selecione ao menos um mês." })
    if (v.id && v.av_months.length > 1) {
      ctx.addIssue({ code: "custom", path: ["av_months"], message: "Ao editar, mantenha apenas um mês." })
    }
    const bad = v.av_dates.find((d) => !v.av_months.includes(d.slice(0, 7)))
    if (bad) ctx.addIssue({ code: "custom", path: ["av_dates"], message: "Cada data deve estar em um dos meses selecionados." })
  })

/** Uma linha de disponibilidade por mês selecionado, com as datas daquele mês. */
export function availabilityRows(v: {
  av_months: string[]
  av_dates: string[]
  av_weekdays: number[]
  av_notes: string | null
  av_follow_up_on: string | null
}) {
  return [...new Set(v.av_months)].sort().map((m) => ({
    availability_month: `${m}-01`,
    specific_dates: v.av_dates.filter((d) => d.startsWith(m)),
    weekdays: [...new Set(v.av_weekdays)].sort(),
    notes: v.av_notes,
    follow_up_on: v.av_follow_up_on,
  }))
}
