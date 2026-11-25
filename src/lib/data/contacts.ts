import "server-only"

import type { ContactLatestRow } from "@/types/database"

import { query, unwrap } from "./result"
import type { ContactLogWithRelations } from "./types"

/** Histórico completo de contatos (mais recentes primeiro). */
export async function listContactLogs(limit = 300) {
  return query<ContactLogWithRelations[]>([], async (supabase) => {
    const res = await supabase
      .from("contact_logs")
      .select(
        "*, preacher:preachers(id, full_name, category, phone, whatsapp), service:services(id, service_date, service_type, period)"
      )
      .order("contacted_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit)
    return unwrap(res, []) as ContactLogWithRelations[]
  })
}

/** Situação atual de cada pregador (último contato registrado). */
export async function listContactLatest() {
  return query<ContactLatestRow[]>([], async (supabase) => {
    const res = await supabase.from("contact_latest").select("*").order("contacted_at", { ascending: false })
    return unwrap(res, [])
  })
}
