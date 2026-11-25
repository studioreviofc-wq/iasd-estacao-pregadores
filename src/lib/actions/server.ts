import "server-only"

import { refresh } from "next/cache"
import { z } from "zod"

import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

import { checkRotation } from "@/lib/data/rotation"
import type { ServicePeriod } from "@/types/database"

import type { ActionState } from "./state"

type Client = Awaited<ReturnType<typeof createClient>>

type ErrorExtra = Pick<Extract<ActionState, { status: "error" }>, "rotation" | "duplicates">

export class ActionError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
    public extra?: ErrorExtra
  ) {
    super(message)
  }
}

/**
 * Verifica a rotatividade antes de escalar. Conflito simultâneo bloqueia;
 * alertas (intervalo mínimo, meses consecutivos) exigem confirmação explícita.
 */
export async function guardRotation(
  supabase: Client,
  input: { preacherId: string; preacherName?: string; date: string; period: ServicePeriod; serviceId: string | null; confirmed: boolean }
) {
  const result = await checkRotation(supabase, input)
  if (result.blocked) throw new ActionError(`Não é possível escalar: ${result.blocked.toLowerCase()}`)
  if (result.warnings.length && !input.confirmed) {
    let name = input.preacherName
    if (!name) {
      const { data } = await supabase.from("preachers").select("full_name").eq("id", input.preacherId).maybeSingle()
      name = data?.full_name ?? "Pregador"
    }
    throw new ActionError("Este pregador não atende ao intervalo recomendado.", undefined, {
      rotation: { preacher: name, warnings: result.warnings },
    })
  }
}

/** Traduz erros do Postgres/PostgREST para mensagens em português. */
export function dbError(error: { code?: string; message: string }, context?: { unique?: string }): ActionError {
  // Regras de negócio levantadas pelos triggers já vêm em português.
  if ((error.code === "23514" || error.code === "23502") && !/^(new row|null value)/i.test(error.message)) {
    return new ActionError(error.message)
  }
  switch (error.code) {
    case "23505":
      return new ActionError(context?.unique ?? "Já existe um registro com esses dados.")
    case "23503":
      return new ActionError("Este registro possui histórico vinculado e não pode ser removido.")
    case "23514":
      return new ActionError("Os dados não atendem às regras da escala.")
    case "42501":
      return new ActionError("Você não tem permissão para esta ação.")
    default:
      console.error("[action]", error)
      return new ActionError("Não foi possível salvar. Tente novamente.")
  }
}

/** Valida o FormData com zod; erros viram mensagens por campo. */
export function parseForm<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const fieldErrors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join(".")
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  throw new ActionError("Revise os campos destacados.", fieldErrors)
}

/** Valida antes de tocar no banco: devolve os dados ou o estado de erro do formulário. */
export function validateForm<S extends z.ZodType>(
  schema: S,
  input: unknown
): { ok: true; data: z.output<S> } | { ok: false; state: ActionState } {
  try {
    return { ok: true, data: parseForm(schema, input) }
  } catch (error) {
    const e = error as ActionError
    return { ok: false, state: { status: "error", message: e.message, fieldErrors: e.fieldErrors } }
  }
}

/**
 * Executa uma mutação autenticada. A permissão real é garantida pelo RLS;
 * aqui só antecipamos a mensagem para quem não faz parte da equipe.
 */
export async function runAction(
  successMessage: string,
  fn: (supabase: Client) => Promise<void>
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "O banco de dados ainda não foi configurado. Veja Configurações." }
  }

  try {
    const supabase = await createClient()
    const { data: isStaff, error } = await supabase.rpc("is_staff")
    if (error) throw dbError(error)
    if (!isStaff) throw new ActionError("Seu usuário tem acesso somente de leitura.")

    await fn(supabase)
    refresh()
    return { status: "success", message: successMessage }
  } catch (error) {
    if (error instanceof ActionError) {
      return { status: "error", message: error.message, fieldErrors: error.fieldErrors, ...error.extra }
    }
    console.error("[action]", error)
    return { status: "error", message: "Erro inesperado. Tente novamente." }
  }
}
