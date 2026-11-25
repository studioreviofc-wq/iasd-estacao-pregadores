"use server"

import { endOfMonth } from "date-fns"
import { z } from "zod"

import { ActionError, dbError, guardRotation, runAction, validateForm } from "@/lib/actions/server"
import type { ActionState } from "@/lib/actions/state"
import { fromISODate, toISODate } from "@/lib/domain/dates"
import { formToObject } from "@/lib/validation/fields"
import { requiresPreacher, serviceSchema, serviceStatuses } from "@/lib/validation/service"
import type { Database, ServiceRow, ServiceStatus } from "@/types/database"

type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"]

/** Carimba as datas de convite/confirmação conforme a transição de status. */
function statusTimestamps(next: ServiceStatus, previous?: Pick<ServiceRow, "status">): ServiceUpdate {
  const now = new Date().toISOString()
  const patch: ServiceUpdate = {}
  if (next === "convidado" && previous?.status !== "convidado") patch.invited_at = now
  if (next === "confirmado" && previous?.status !== "confirmado") patch.confirmed_at = now
  if (next === "aberto") {
    patch.invited_at = null
    patch.confirmed_at = null
  }
  return patch
}

export async function saveService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validateForm(serviceSchema, formToObject(formData))
  if (!parsed.ok) return parsed.state
  const { id, service_date, period, title, ...values } = parsed.data
  const confirmedRotation = formData.get("confirm_rotation") === "on"

  return runAction(id ? "Culto atualizado." : "Culto extraordinário criado.", async (supabase) => {
    if (!id) {
      if (values.preacher_id && (values.status === "convidado" || values.status === "confirmado")) {
        await guardRotation(supabase, {
          preacherId: values.preacher_id,
          date: service_date!,
          period: period!,
          serviceId: null,
          confirmed: confirmedRotation,
        })
      }
      const { error } = await supabase.from("services").insert({
        ...values,
        service_type: "especial",
        service_date: service_date!,
        period: period!,
        title,
        ...statusTimestamps(values.status),
      })
      if (error) throw dbError(error)
      return
    }

    const { data: current, error: readError } = await supabase
      .from("services")
      .select("status, service_type, service_date, period, preacher_id")
      .eq("id", id)
      .single()
    if (readError) throw dbError(readError)

    const special = current.service_type === "especial"
    const targetDate = special && service_date ? service_date : current.service_date
    const targetPeriod = special && period ? period : current.period
    const changedSlot = values.preacher_id !== current.preacher_id || targetDate !== current.service_date || targetPeriod !== current.period
    if (values.preacher_id && changedSlot && (values.status === "convidado" || values.status === "confirmado")) {
      await guardRotation(supabase, {
        preacherId: values.preacher_id,
        date: targetDate,
        period: targetPeriod,
        serviceId: id,
        confirmed: confirmedRotation,
      })
    }

    // Data, período e nome só mudam em cultos extraordinários.
    const patch: ServiceUpdate = {
      ...values,
      ...(special ? { service_date: service_date ?? undefined, period, title } : {}),
      ...statusTimestamps(values.status, current),
    }
    const { error } = await supabase.from("services").update(patch).eq("id", id)
    if (error) throw dbError(error)
  })
}

export async function updateServiceStatus(id: string, status: ServiceStatus): Promise<ActionState> {
  return runAction("Status atualizado.", async (supabase) => {
    const serviceId = z.uuid().parse(id)
    const nextStatus = z.enum(serviceStatuses).parse(status)
    const { data: current, error: readError } = await supabase
      .from("services")
      .select("status, preacher_id")
      .eq("id", serviceId)
      .single()
    if (readError) throw dbError(readError)
    if (requiresPreacher(nextStatus) && !current.preacher_id) {
      throw new ActionError("Vincule um pregador antes de mudar para este status.")
    }
    const patch: ServiceUpdate = {
      status: nextStatus,
      ...statusTimestamps(nextStatus, current),
      ...(nextStatus === "aberto" ? { preacher_id: null } : {}),
    }
    const { error } = await supabase.from("services").update(patch).eq("id", serviceId)
    if (error) throw dbError(error)
  })
}

/** Remove o pregador do culto; a vaga volta a "em aberto" (cancelados seguem cancelados). */
export async function unlinkPreacher(id: string): Promise<ActionState> {
  return runAction("Pregador desvinculado.", async (supabase) => {
    const serviceId = z.uuid().parse(id)
    const { data: current, error: readError } = await supabase
      .from("services")
      .select("status")
      .eq("id", serviceId)
      .single()
    if (readError) throw dbError(readError)
    const patch: ServiceUpdate =
      current.status === "cancelado"
        ? { preacher_id: null }
        : { preacher_id: null, status: "aberto", invited_at: null, confirmed_at: null }
    const { error } = await supabase.from("services").update(patch).eq("id", serviceId)
    if (error) throw dbError(error)
  })
}

/** Exclui um culto extraordinário. Cultos regulares devem ser cancelados. */
export async function deleteService(id: string): Promise<ActionState> {
  return runAction("Culto extraordinário excluído.", async (supabase) => {
    const serviceId = z.uuid().parse(id)
    const { data, error } = await supabase
      .from("services")
      .delete()
      .eq("id", serviceId)
      .eq("service_type", "especial")
      .select("id")
    if (error) throw dbError(error)
    if (!data?.length) throw new ActionError("Cultos regulares não são excluídos — use o status “Cancelado”.")
  })
}

/** Garante os cultos regulares do mês (idempotente: não duplica). */
export async function generateMonthServices(monthKey: string): Promise<ActionState> {
  let created = 0
  const result = await runAction("", async (supabase) => {
    if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new ActionError("Mês inválido.")
    const start = `${monthKey}-01`
    const end = toISODate(endOfMonth(fromISODate(start)))
    const { data, error } = await supabase.rpc("generate_regular_services", { p_start: start, p_end: end })
    if (error) throw dbError(error)
    created = data ?? 0
  })
  if (result.status !== "success") return result
  return {
    status: "success",
    message:
      created === 0
        ? "Todos os cultos regulares do mês já estão na escala."
        : `${created} ${created === 1 ? "culto regular criado" : "cultos regulares criados"}.`,
  }
}
