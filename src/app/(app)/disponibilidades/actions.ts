"use server"

import { z } from "zod"

import { ActionError, dbError, guardRotation, runAction, validateForm } from "@/lib/actions/server"
import type { ActionState } from "@/lib/actions/state"
import { availabilityCovers } from "@/lib/domain/availability"
import { availabilityRows, availabilitySchema, availabilityStatusesManual } from "@/lib/validation/contact"
import { formToObject } from "@/lib/validation/fields"
import { availabilityArrays } from "@/lib/validation/form-arrays"

export async function saveAvailability(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validateForm(availabilitySchema, { ...formToObject(formData), ...availabilityArrays(formData) })
  if (!parsed.ok) return parsed.state
  const { id, preacher_id, ...v } = parsed.data
  const rows = availabilityRows(v)

  return runAction(
    id ? "Disponibilidade atualizada." : rows.length > 1 ? `${rows.length} meses de disponibilidade registrados.` : "Disponibilidade registrada.",
    async (supabase) => {
      const { error } = id
        ? await supabase.from("availabilities").update({ ...rows[0], preacher_id }).eq("id", id)
        : await supabase.from("availabilities").insert(rows.map((r) => ({ ...r, preacher_id })))
      if (error) throw dbError(error)
    }
  )
}

/** Mudança manual de status (agendado é definido pela escala). O histórico é gravado pelo banco. */
export async function setAvailabilityStatus(
  id: string,
  status: (typeof availabilityStatusesManual)[number]
): Promise<ActionState> {
  return runAction("Status da disponibilidade atualizado.", async (supabase) => {
    const next = z.enum(availabilityStatusesManual).parse(status)
    const { error } = await supabase.from("availabilities").update({ status: next }).eq("id", z.uuid().parse(id))
    if (error) throw dbError(error)
  })
}

export async function deleteAvailability(id: string): Promise<ActionState> {
  return runAction("Disponibilidade removida.", async (supabase) => {
    const { error } = await supabase.from("availabilities").delete().eq("id", z.uuid().parse(id))
    if (error) throw dbError(error)
  })
}

/**
 * Vincula o pregador da disponibilidade a um culto. Nada é confirmado sozinho:
 * o usuário escolhe "aguardando confirmação" ou "confirmado". A disponibilidade
 * passa a "aguardando nova confirmação" ou "agendado" pelo trigger do banco.
 */
export async function linkAvailabilityToService(
  availabilityId: string,
  serviceId: string,
  status: "convidado" | "confirmado",
  confirmRotation = false
): Promise<ActionState> {
  return runAction(status === "confirmado" ? "Pregador escalado e confirmado." : "Pregador escalado — aguardando confirmação.", async (supabase) => {
    const avId = z.uuid().parse(availabilityId)
    const svcId = z.uuid().parse(serviceId)
    const nextStatus = z.enum(["convidado", "confirmado"]).parse(status)

    const [{ data: av, error: avError }, { data: svc, error: svcError }] = await Promise.all([
      supabase.from("availabilities").select("*").eq("id", avId).single(),
      supabase.from("services").select("id, service_date, period, status, preacher_id").eq("id", svcId).single(),
    ])
    if (avError) throw dbError(avError)
    if (svcError) throw dbError(svcError)

    if (svc.status === "realizado" || svc.status === "cancelado") throw new ActionError("Este culto não pode receber escala.")
    if (svc.status === "confirmado" && svc.preacher_id !== av.preacher_id) {
      throw new ActionError("Este culto já tem outro pregador confirmado.")
    }
    if (!availabilityCovers(av, svc.service_date)) {
      throw new ActionError("A data do culto está fora da disponibilidade informada.")
    }

    if (svc.preacher_id !== av.preacher_id) {
      await guardRotation(supabase, {
        preacherId: av.preacher_id,
        date: svc.service_date,
        period: svc.period,
        serviceId: svc.id,
        confirmed: confirmRotation,
      })
    }

    // Marca qual disponibilidade deve ser usada pelo trigger de sincronização.
    const { error: linkError } = await supabase.from("availabilities").update({ service_id: svcId }).eq("id", avId)
    if (linkError) throw dbError(linkError)

    const now = new Date().toISOString()
    const { error } = await supabase
      .from("services")
      .update({
        preacher_id: av.preacher_id,
        status: nextStatus,
        ...(nextStatus === "confirmado" ? { confirmed_at: now } : { invited_at: now }),
      })
      .eq("id", svcId)
    if (error) throw dbError(error)
  })
}
