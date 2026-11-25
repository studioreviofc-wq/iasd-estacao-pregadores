import { z } from "zod"

import { optionalDate, optionalId, optionalText, optionalTime } from "./fields"

export const serviceTypes = ["sabado_manha", "sabado_tarde", "domingo_noite", "quarta_noite", "especial"] as const
export const serviceStatuses = ["aberto", "convidado", "confirmado", "realizado", "cancelado"] as const
export const servicePeriods = ["manha", "tarde", "noite"] as const

/** Status que exigem um pregador definido (espelha a constraint do banco). */
export const statusesRequiringPreacher = ["convidado", "confirmado", "realizado"] as const

export function requiresPreacher(status: string) {
  return (statusesRequiringPreacher as readonly string[]).includes(status)
}

/**
 * Formulário do culto. Para cultos regulares só valem escala, status e textos;
 * data, período e nome são usados apenas em cultos extraordinários.
 */
export const serviceSchema = z
  .object({
    id: optionalId,
    service_date: optionalDate,
    period: z.enum(servicePeriods).optional(),
    title: optionalText(120),
    start_time: optionalTime,
    preacher_id: optionalId,
    status: z.enum(serviceStatuses, { error: "Selecione o status." }),
    sermon_title: optionalText(200),
    bible_reference: optionalText(120),
    notes: optionalText(1000),
  })
  .transform((v) =>
    // Escolher um pregador numa vaga em aberto equivale a convidá-lo.
    v.status === "aberto" && v.preacher_id ? { ...v, status: "convidado" as const } : v
  )
  .superRefine((v, ctx) => {
    if (requiresPreacher(v.status) && !v.preacher_id) {
      ctx.addIssue({ code: "custom", path: ["preacher_id"], message: "Selecione o pregador para este status." })
    }
    if (!v.id) {
      if (!v.service_date) ctx.addIssue({ code: "custom", path: ["service_date"], message: "Informe a data." })
      if (!v.period) ctx.addIssue({ code: "custom", path: ["period"], message: "Selecione o período." })
    }
  })

/** Dia da semana (0 = domingo) de cada culto regular — espelha regular_weekday() no banco. */
export const serviceTypeWeekday: Partial<Record<(typeof serviceTypes)[number], number>> = {
  sabado_manha: 6,
  sabado_tarde: 6,
  domingo_noite: 0,
  quarta_noite: 3,
}
