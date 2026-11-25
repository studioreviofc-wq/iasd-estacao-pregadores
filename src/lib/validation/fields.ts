import { z } from "zod"

/** Texto opcional: string vazia vira `null`. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : null))

export const requiredText = (label: string, max = 200) =>
  z
    .string({ error: `Informe ${label}.` })
    .trim()
    .min(1, `Informe ${label}.`)
    .max(max, `Use no máximo ${max} caracteres.`)

export const isoDate = (label: string) =>
  z.string({ error: `Informe ${label}.` }).regex(/^\d{4}-\d{2}-\d{2}$/, `Informe ${label}.`)

export const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.")

export const optionalTime = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{2}:\d{2}(:\d{2})?$/.test(v), "Horário inválido.")

/** UUID opcional vindo de um <select> ("" ou "none" = nenhum). */
export const optionalId = z
  .string()
  .optional()
  .transform((v) => (v && v !== "none" ? v : null))
  .refine((v) => v === null || z.uuid().safeParse(v).success, "Seleção inválida.")

export const requiredId = (label: string) => z.uuid({ error: `Selecione ${label}.` })

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true")

export const phone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || v.replace(/\D/g, "").length >= 8, "Telefone incompleto.")

export const email = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.toLowerCase() : null))
  .refine((v) => v === null || z.email().safeParse(v).success, "E-mail inválido.")

export function formToObject(formData: FormData) {
  const obj: Record<string, string> = {}
  formData.forEach((value, key) => {
    if (typeof value === "string" && !key.startsWith("$")) obj[key] = value
  })
  return obj
}
