"use server"

import { z } from "zod"

import { ActionError, dbError, guardRotation, runAction, validateForm } from "@/lib/actions/server"
import type { ActionState } from "@/lib/actions/state"
import { todayISO } from "@/lib/domain/dates"
import type { createClient } from "@/lib/supabase/server"
import { availabilityRows, contactSchema } from "@/lib/validation/contact"
import { formToObject } from "@/lib/validation/fields"
import { availabilityArrays } from "@/lib/validation/form-arrays"
import type { ContactOutcome, Database } from "@/types/database"

type Client = Awaited<ReturnType<typeof createClient>>
type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"]

/** Data do contato → timestamp (hoje = agora; outras datas = meio-dia em Maceió). */
function contactedAt(date: string) {
  return date === todayISO() ? new Date().toISOString() : `${date}T12:00:00-03:00`
}

/**
 * Reflete a resposta no culto vinculado (quando o convite foi para um culto específico):
 *   aguardando → culto "aguardando confirmação" com este pregador
 *   aceito     → culto "confirmado"
 *   indisponível / outro mês / novo contato → se o culto era deste pregador, a vaga reabre
 * Cultos realizados ou cancelados não são alterados. A disponibilidade é atualizada
 * pelo banco (trigger) quando a escala muda.
 */
async function syncService(
  supabase: Client,
  serviceId: string | null,
  preacherId: string,
  outcome: ContactOutcome,
  confirmedRotation: boolean
) {
  if (!serviceId || outcome === "nao_contatado") return

  const { data: service, error } = await supabase
    .from("services")
    .select("status, preacher_id, invited_at, service_date, period")
    .eq("id", serviceId)
    .single()
  if (error) throw dbError(error)
  if (service.status === "realizado" || service.status === "cancelado") return

  const now = new Date().toISOString()
  const samePreacher = service.preacher_id === preacherId
  const otherConfirmed = service.status === "confirmado" && service.preacher_id && !samePreacher
  let patch: ServiceUpdate | null = null

  if (outcome === "aguardando" || outcome === "aceito") {
    if (otherConfirmed) throw new ActionError("Este culto já tem outro pregador confirmado.")
    if (!samePreacher) {
      await guardRotation(supabase, {
        preacherId,
        date: service.service_date,
        period: service.period,
        serviceId,
        confirmed: confirmedRotation,
      })
    }
    patch =
      outcome === "aceito"
        ? { status: "confirmado", preacher_id: preacherId, confirmed_at: now }
        : service.status === "confirmado"
          ? null
          : { status: "convidado", preacher_id: preacherId, invited_at: samePreacher && service.invited_at ? service.invited_at : now }
  } else if (samePreacher) {
    patch = { status: "aberto", preacher_id: null, invited_at: null, confirmed_at: null }
  }

  if (patch) {
    const { error: updateError } = await supabase.from("services").update(patch).eq("id", serviceId)
    if (updateError) throw dbError(updateError)
  }
}

/**
 * Registra uma interação. Contatos nunca são sobrescritos: cada nova resposta
 * cria um novo registro, ligado ao anterior por `previous_id`.
 */
export async function saveContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validateForm(contactSchema, { ...formToObject(formData), ...availabilityArrays(formData) })
  if (!parsed.ok) return parsed.state
  const v = parsed.data

  return runAction(
    v.outcome === "outro_mes" ? "Contato e disponibilidade registrados." : "Contato registrado.",
    async (supabase) => {
      let invitedForMonth = v.target === "mes" && v.invited_for_month ? `${v.invited_for_month}-01` : null
      if (v.target === "culto" && v.service_id) {
        const { data: s, error } = await supabase.from("services").select("service_date").eq("id", v.service_id).single()
        if (error) throw dbError(error)
        invitedForMonth = `${s.service_date.slice(0, 7)}-01`
      }

      await syncService(
        supabase,
        v.target === "culto" ? v.service_id : null,
        v.preacher_id,
        v.outcome,
        formData.get("confirm_rotation") === "on"
      )

      const { data: contact, error } = await supabase
        .from("contact_logs")
        .insert({
          preacher_id: v.preacher_id,
          previous_id: v.previous_id,
          channel: v.channel,
          outcome: v.outcome,
          contacted_at: contactedAt(v.contacted_on),
          invited_for_month: invitedForMonth,
          service_id: v.target === "culto" ? v.service_id : null,
          follow_up_on: v.follow_up_on ?? (v.outcome === "outro_mes" ? v.av_follow_up_on : null),
          notes: v.notes,
        })
        .select("id")
        .single()
      if (error) throw dbError(error)

      if (v.outcome === "outro_mes") {
        const rows = availabilityRows(v).map((r) => ({ ...r, preacher_id: v.preacher_id, source_contact_id: contact.id }))
        const { error: avError } = await supabase.from("availabilities").insert(rows)
        if (avError) throw dbError(avError)
      }
    }
  )
}

/** Exclusão apenas para lançamentos feitos por engano (o histórico normal não é apagado). */
export async function deleteContact(id: string): Promise<ActionState> {
  return runAction("Registro de contato excluído.", async (supabase) => {
    const { error } = await supabase.from("contact_logs").delete().eq("id", z.uuid().parse(id))
    if (error) throw dbError(error)
  })
}
