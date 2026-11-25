import { z } from "zod"

import { isoDate, optionalId, optionalText, requiredId } from "./fields"
import { serviceTypes } from "./service"

export const availabilitySchema = z
  .object({
    id: optionalId,
    preacher_id: requiredId("o pregador"),
    start_date: isoDate("a data inicial"),
    end_date: z
      .string()
      .optional()
      .transform((v) => v || null),
    service_types: z.array(z.enum(serviceTypes)).default([]),
    notes: optionalText(500),
  })
  .transform((v) => ({ ...v, end_date: v.end_date ?? v.start_date }))
  .superRefine((v, ctx) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.end_date)) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "Data final inválida." })
    } else if (v.end_date < v.start_date) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "A data final deve ser igual ou posterior à inicial." })
    }
  })
