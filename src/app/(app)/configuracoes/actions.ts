"use server"

import { z } from "zod"

import { ActionError, dbError, runAction, validateForm } from "@/lib/actions/server"
import type { ActionState } from "@/lib/actions/state"
import { formToObject } from "@/lib/validation/fields"
import { endOfMonth } from "date-fns"

import { fromISODate, toISODate } from "@/lib/domain/dates"
import { churchSettingsFormSchema, userRoles } from "@/lib/validation/settings"
import type { UserRole } from "@/types/database"

export async function saveChurchSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validateForm(churchSettingsFormSchema, {
    ...formToObject(formData),
    default_service_types: formData.getAll("default_service_types"),
  })
  if (!parsed.ok) return parsed.state
  const { schedule_start, schedule_end, ...rest } = parsed.data
  const start = `${schedule_start}-01`
  const end = toISODate(endOfMonth(fromISODate(`${schedule_end}-01`)))
  const values = { ...rest, schedule_start: start, schedule_end: end }
  let created = 0
  const result = await runAction("Configurações salvas.", async (supabase) => {
    // O RLS só permite ao administrador; sem linhas afetadas = sem permissão.
    const { data, error } = await supabase.from("church_settings").update(values).eq("id", 1).select("id")
    if (error) throw dbError(error)
    if (!data?.length) throw new ActionError("Somente administradores podem alterar as configurações.")

    // Garante os cultos regulares de toda a faixa (idempotente).
    const { data: count, error: genError } = await supabase.rpc("generate_regular_services", {
      p_start: start,
      p_end: end,
    })
    if (genError) throw dbError(genError)
    created = count ?? 0
  })
  if (result.status === "success" && created > 0) {
    return { status: "success", message: `Configurações salvas. ${created} novos cultos adicionados à escala.` }
  }
  return result
}

/** Libera ou revoga o acesso de um usuário (somente administrador). */
export async function setUserApproved(userId: string, approved: boolean): Promise<ActionState> {
  return runAction(approved ? "Acesso liberado." : "Acesso revogado.", async (supabase) => {
    const id = z.uuid().parse(userId)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.id === id && !approved) throw new ActionError("Você não pode revogar o próprio acesso.")
    const { data, error } = await supabase
      .from("profiles")
      .update({ approved, approved_at: approved ? new Date().toISOString() : null })
      .eq("id", id)
      .select("id")
    if (error) throw dbError(error)
    if (!data?.length) throw new ActionError("Somente administradores podem liberar acessos.")
  })
}

export async function updateUserRole(userId: string, role: UserRole): Promise<ActionState> {
  return runAction("Permissão atualizada.", async (supabase) => {
    const id = z.uuid().parse(userId)
    const nextRole = z.enum(userRoles).parse(role)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.id === id && nextRole !== "administrador") {
      throw new ActionError("Você não pode remover a sua própria permissão de administrador.")
    }

    const { data, error } = await supabase.from("profiles").update({ role: nextRole }).eq("id", id).select("id")
    if (error) throw dbError(error)
    if (!data?.length) throw new ActionError("Somente administradores podem alterar permissões.")
  })
}
