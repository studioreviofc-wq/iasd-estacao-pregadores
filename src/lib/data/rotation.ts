import "server-only"

import { DEFAULT_ROTATION, assessRotation, type RotationSettings, type RotationSnapshot } from "@/lib/domain/rotation"
import type { createClient } from "@/lib/supabase/server"
import type { ServicePeriod } from "@/types/database"

type Client = Awaited<ReturnType<typeof createClient>>

export async function loadRotationSettings(supabase: Client): Promise<RotationSettings> {
  const { data } = await supabase
    .from("church_settings")
    .select("min_interval_days, consecutive_month_alert")
    .eq("id", 1)
    .maybeSingle()
  return data
    ? { minIntervalDays: data.min_interval_days, consecutiveMonthAlert: data.consecutive_month_alert }
    : DEFAULT_ROTATION
}

export async function loadRotationSnapshots(
  supabase: Client,
  date: string,
  period: ServicePeriod,
  excludeServiceId: string | null
): Promise<RotationSnapshot[]> {
  const { data, error } = await supabase.rpc("rotation_snapshot", {
    p_date: date,
    p_period: period,
    p_exclude_service: excludeServiceId,
  })
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Avalia um pregador para um culto (usado nas Server Actions antes de escalar).
 * Conflito = bloqueio; intervalos e meses consecutivos = alertas que pedem confirmação.
 */
export async function checkRotation(
  supabase: Client,
  input: { preacherId: string; date: string; period: ServicePeriod; serviceId: string | null }
) {
  const [settings, snapshots] = await Promise.all([
    loadRotationSettings(supabase),
    loadRotationSnapshots(supabase, input.date, input.period, input.serviceId),
  ])
  return assessRotation(
    snapshots.find((s) => s.preacher_id === input.preacherId),
    input.date,
    settings
  )
}
