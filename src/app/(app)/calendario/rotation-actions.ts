"use server"

import { z } from "zod"

import { loadRotationSettings, loadRotationSnapshots } from "@/lib/data/rotation"
import { DEFAULT_ROTATION, type RotationSettings, type RotationSnapshot } from "@/lib/domain/rotation"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"
import { servicePeriods } from "@/lib/validation/service"

export type RotationContext = { settings: RotationSettings; snapshots: RotationSnapshot[]; error?: string }

/** Dados de repetição para sugerir pregadores numa data de culto (somente leitura). */
export async function getRotationContext(input: {
  date: string
  period: string
  serviceId?: string | null
}): Promise<RotationContext> {
  if (!isSupabaseConfigured()) return { settings: DEFAULT_ROTATION, snapshots: [] }
  const parsed = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      period: z.enum(servicePeriods),
      serviceId: z.uuid().nullish(),
    })
    .safeParse(input)
  if (!parsed.success) return { settings: DEFAULT_ROTATION, snapshots: [], error: "Data ou período inválido." }

  try {
    const supabase = await createClient()
    const [settings, snapshots] = await Promise.all([
      loadRotationSettings(supabase),
      loadRotationSnapshots(supabase, parsed.data.date, parsed.data.period, parsed.data.serviceId ?? null),
    ])
    return { settings, snapshots }
  } catch (e) {
    return { settings: DEFAULT_ROTATION, snapshots: [], error: e instanceof Error ? e.message : "Erro ao calcular a rotatividade." }
  }
}
