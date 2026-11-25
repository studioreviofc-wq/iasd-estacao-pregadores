"use server"

import { z } from "zod"

import { ActionError, dbError, runAction, validateForm } from "@/lib/actions/server"
import type { ActionState } from "@/lib/actions/state"
import { findDuplicates, type DuplicateMatch } from "@/lib/domain/duplicates"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"
import { formToObject } from "@/lib/validation/fields"
import { preacherSchema } from "@/lib/validation/preacher"

type Client = Awaited<ReturnType<typeof createClient>>

async function duplicatesFor(supabase: Client, input: { full_name: string; phone: string | null; excludeId?: string | null }) {
  const { data, error } = await supabase.from("preachers").select("id, full_name, phone, phone_normalized, archived_at")
  if (error) throw dbError(error)
  return findDuplicates(data ?? [], input)
}

/** Consulta de duplicados enquanto o usuário preenche o formulário (não grava nada). */
export async function checkPreacherDuplicates(input: {
  full_name: string
  phone: string
  excludeId?: string | null
}): Promise<DuplicateMatch[]> {
  if (!isSupabaseConfigured() || input.full_name.trim().length < 3) return []
  try {
    const supabase = await createClient()
    return await duplicatesFor(supabase, input)
  } catch {
    return []
  }
}

export async function savePreacher(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validateForm(preacherSchema, {
    ...formToObject(formData),
    preferred_weekdays: formData.getAll("preferred_weekdays"),
  })
  if (!parsed.ok) return parsed.state
  const { id, confirm_duplicate, ...values } = parsed.data

  let duplicates: DuplicateMatch[] = []
  const result = await runAction(id ? "Pregador atualizado." : "Pregador cadastrado.", async (supabase) => {
    if (!confirm_duplicate) {
      duplicates = await duplicatesFor(supabase, { full_name: values.full_name, phone: values.phone, excludeId: id })
      if (duplicates.length) throw new ActionError("Possível cadastro duplicado.")
    }
    const { error } = id
      ? await supabase.from("preachers").update(values).eq("id", id)
      : await supabase.from("preachers").insert(values)
    if (error) throw dbError(error)
  })

  return duplicates.length && result.status === "error" ? { ...result, duplicates } : result
}

export async function setPreacherActive(id: string, isActive: boolean): Promise<ActionState> {
  return runAction(isActive ? "Pregador reativado." : "Pregador marcado como inativo.", async (supabase) => {
    const { error } = await supabase.from("preachers").update({ is_active: isActive }).eq("id", z.uuid().parse(id))
    if (error) throw dbError(error)
  })
}

/** Arquivar: some das listas e da escala, mas todo o histórico é preservado. */
export async function setPreacherArchived(id: string, archived: boolean): Promise<ActionState> {
  return runAction(archived ? "Pregador arquivado. O histórico foi preservado." : "Pregador restaurado.", async (supabase) => {
    const patch = archived ? { archived_at: new Date().toISOString(), is_active: false } : { archived_at: null, is_active: true }
    const { error } = await supabase.from("preachers").update(patch).eq("id", z.uuid().parse(id))
    if (error) throw dbError(error)
  })
}

/**
 * Exclusão definitiva só para cadastros sem nenhum histórico
 * (cultos, contatos, disponibilidades ou eventos). Caso contrário: arquivar.
 */
export async function deletePreacher(id: string): Promise<ActionState> {
  return runAction("Cadastro excluído.", async (supabase) => {
    const preacherId = z.uuid().parse(id)
    const tables = ["services", "contact_logs", "availabilities", "preacher_events"] as const
    const counts = await Promise.all(
      tables.map((t) => supabase.from(t).select("id", { count: "exact", head: true }).eq("preacher_id", preacherId))
    )
    for (const c of counts) if (c.error) throw dbError(c.error)
    if (counts.some((c) => (c.count ?? 0) > 0)) {
      throw new ActionError("Este pregador possui histórico e não pode ser excluído. Use “Arquivar” para preservá-lo.")
    }
    const { error } = await supabase.from("preachers").delete().eq("id", preacherId)
    if (error) throw dbError(error)
  })
}
