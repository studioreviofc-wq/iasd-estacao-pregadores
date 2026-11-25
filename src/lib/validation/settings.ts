import { z } from "zod"

import { optionalText, requiredText } from "./fields"
import { serviceTypes } from "./service"

export const churchSettingsSchema = z.object({
  church_name: requiredText("o nome da igreja", 160),
  district: optionalText(120),
  city: optionalText(120),
  default_service_types: z.array(z.enum(serviceTypes)).default([]),
  schedule_start: z.string().regex(/^\d{4}-\d{2}$/, "Use o formato aaaa-mm."),
  schedule_end: z.string().regex(/^\d{4}-\d{2}$/, "Use o formato aaaa-mm."),
  whatsapp_template: requiredText("a mensagem padrão do WhatsApp", 1000),
  min_interval_days: z.coerce
    .number({ error: "Informe um número." })
    .int("Use um número inteiro.")
    .min(0, "Mínimo 0.")
    .max(365, "Máximo 365."),
  consecutive_month_alert: z
    .union([z.literal("on"), z.literal("")])
    .optional()
    .transform((v) => v === "on"),
  invite_lead_days: z.coerce
    .number({ error: "Informe um número." })
    .int("Use um número inteiro.")
    .min(0, "Mínimo 0.")
    .max(365, "Máximo 365."),
})

export const churchSettingsFormSchema = churchSettingsSchema.superRefine((v, ctx) => {
  if (v.schedule_end < v.schedule_start) {
    ctx.addIssue({ code: "custom", path: ["schedule_end"], message: "O fim deve ser igual ou posterior ao início." })
  }
  const years = Number(v.schedule_end.slice(0, 4)) - Number(v.schedule_start.slice(0, 4))
  if (years > 9) ctx.addIssue({ code: "custom", path: ["schedule_end"], message: "Faixa máxima de 10 anos." })
})

export const userRoles = ["administrador", "secretario", "leitor"] as const
