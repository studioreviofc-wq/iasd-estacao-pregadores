import { z } from "zod"

import { formatBrPhone, validateBrPhone } from "@/lib/domain/phone"

import { checkbox, email, optionalId, optionalText, requiredText } from "./fields"

export const preacherCategories = ["pastor", "anciao", "diacono", "membro", "convidado", "outro"] as const

const requiredPhone = z
  .string({ error: "Informe o telefone com DDD." })
  .trim()
  .superRefine((v, ctx) => {
    const error = validateBrPhone(v)
    if (error) ctx.addIssue({ code: "custom", message: error })
  })
  .transform((v) => formatBrPhone(v))

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .superRefine((v, ctx) => {
    if (!v) return
    const error = validateBrPhone(v)
    if (error) ctx.addIssue({ code: "custom", message: error })
  })
  .transform((v) => (v ? formatBrPhone(v) : null))

export const preacherSchema = z.object({
  id: optionalId,
  full_name: requiredText("o nome completo", 120).refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome."),
  phone: requiredPhone,
  whatsapp: optionalPhone,
  email: email,
  category: z.enum(preacherCategories, { error: "Selecione a função." }),
  role_title: optionalText(80),
  home_church: optionalText(120),
  preferred_weekdays: z
    .array(z.coerce.number().int().min(0).max(6))
    .default([])
    .transform((days) => [...new Set(days)].sort()),
  notes: optionalText(2000),
  is_active: checkbox,
  confirm_duplicate: checkbox,
})
