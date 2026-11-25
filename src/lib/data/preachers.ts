import "server-only"

import { siteConfig } from "@/config/site"
import type {
  AvailabilityEventRow,
  AvailabilityRow,
  ContactLogRow,
  PreacherEventRow,
  PreacherOverviewRow,
  PreacherRow,
  ServiceRow,
} from "@/types/database"

import { query, unwrap } from "./result"

/** Pregadores com estatísticas (última/próxima pregação, total, disponibilidade). */
export async function listPreacherOverview() {
  return query<PreacherOverviewRow[]>([], async (supabase) => {
    const res = await supabase.from("preacher_overview").select("*").order("full_name")
    return unwrap(res, [])
  })
}

export type PreacherOption = Pick<
  PreacherRow,
  "id" | "full_name" | "nickname" | "home_church" | "category" | "is_active" | "archived_at" | "preferred_weekdays"
>

/** Lista enxuta para selects (inclui inativos/arquivados para exibir registros antigos). */
export async function listPreacherOptions() {
  return query<PreacherOption[]>([], async (supabase) => {
    const res = await supabase
      .from("preachers")
      .select("id, full_name, nickname, home_church, category, is_active, archived_at, preferred_weekdays")
      .order("full_name")
    return unwrap(res, [])
  })
}

export type PreacherProfile = {
  preacher: PreacherOverviewRow
  services: ServiceRow[]
  events: PreacherEventRow[]
  contacts: (ContactLogRow & { service: Pick<ServiceRow, "id" | "service_date" | "service_type" | "period"> | null })[]
  availabilities: AvailabilityRow[]
  availabilityEvents: AvailabilityEventRow[]
}

/** Tudo sobre um pregador, para o perfil e o histórico cronológico. */
export async function getPreacherProfile(id: string) {
  return query<PreacherProfile | null>(null, async (supabase) => {
    const preacher = unwrap(await supabase.from("preacher_overview").select("*").eq("id", id).maybeSingle(), null)
    if (!preacher) return null

    const [services, events, contacts, availabilities, availabilityEvents] = await Promise.all([
      supabase.from("services").select("*").eq("preacher_id", id).order("service_date", { ascending: false }),
      supabase.from("preacher_events").select("*").eq("preacher_id", id).order("occurred_at", { ascending: false }),
      supabase
        .from("contact_logs")
        .select("*, service:services(id, service_date, service_type, period)")
        .eq("preacher_id", id)
        .order("contacted_at", { ascending: false }),
      supabase.from("availabilities").select("*").eq("preacher_id", id).order("start_date", { ascending: false }),
      supabase.from("availability_events").select("*").eq("preacher_id", id).order("occurred_at", { ascending: false }),
    ])

    return {
      preacher,
      services: unwrap(services, []),
      events: unwrap(events, []),
      contacts: unwrap(contacts, []) as PreacherProfile["contacts"],
      availabilities: unwrap(availabilities, []),
      availabilityEvents: unwrap(availabilityEvents, []),
    }
  })
}

export type WhatsappContext = { template: string; churchName: string }

const DEFAULT_TEMPLATE =
  "Olá, {primeiro_nome}! Tudo bem? Aqui é da secretaria da {igreja}. Gostaríamos de conversar com você sobre a escala de pregações. Você teria disponibilidade?"

/** Modelo de mensagem do WhatsApp configurado pela igreja. */
export async function getWhatsappContext() {
  const result = await query<WhatsappContext>({ template: DEFAULT_TEMPLATE, churchName: siteConfig.churchName }, async (supabase) => {
    const { data, error } = await supabase
      .from("church_settings")
      .select("church_name, whatsapp_template")
      .eq("id", 1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return {
      template: data?.whatsapp_template || DEFAULT_TEMPLATE,
      churchName: data?.church_name || siteConfig.churchName,
    }
  })
  return result.data
}
