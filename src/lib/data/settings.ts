import "server-only"

import { siteConfig } from "@/config/site"
import type { ScheduleRange } from "@/lib/domain/dates"
import type { AuditLogRow, ChurchSettingsRow, ProfileRow } from "@/types/database"

import { query, unwrap } from "./result"

export type SettingsData = {
  settings: ChurchSettingsRow | null
  profile: ProfileRow | null
  email: string | null
  /** Preenchido apenas para administradores. */
  users: ProfileRow[]
}

export async function getSettings() {
  return query<SettingsData>({ settings: null, profile: null, email: null, users: [] }, async (supabase) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const [settings, profile] = await Promise.all([
      supabase.from("church_settings").select("*").eq("id", 1).maybeSingle(),
      user
        ? supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    const me = unwrap(profile, null)
    const users =
      me?.role === "administrador"
        ? unwrap(await supabase.from("profiles").select("*").order("full_name"), [])
        : []

    return { settings: unwrap(settings, null), profile: me, email: user?.email ?? null, users }
  })
}

/** Faixa de meses da escala (Configurações) — padrão dez/2026 → dez/2027. */
export async function getScheduleRange() {
  const result = await query<ScheduleRange>({ ...siteConfig.defaultSchedule }, async (supabase) => {
    const { data, error } = await supabase
      .from("church_settings")
      .select("schedule_start, schedule_end")
      .eq("id", 1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return { ...siteConfig.defaultSchedule }
    return { start: data.schedule_start.slice(0, 7), end: data.schedule_end.slice(0, 7) }
  })
  return result.data
}


/** Últimas alterações relevantes (somente administrador — garantido pelo RLS). */
export async function listAuditLog(limit = 60) {
  return query<AuditLogRow[]>([], async (supabase) => {
    const { data, error } = await supabase.from("audit_log").select("*").order("changed_at", { ascending: false }).limit(limit)
    if (error) throw new Error(error.message)
    return data ?? []
  })
}
