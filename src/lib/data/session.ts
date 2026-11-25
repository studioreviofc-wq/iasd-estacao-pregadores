import "server-only"

import { query } from "./result"

export type SessionUser = { email: string; name: string } | null

/** Usuário autenticado (para o rodapé da sidebar). */
export async function getSessionUser() {
  return query<SessionUser>(null, async (supabase) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const name = (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? ""
    return { email: user.email ?? "", name }
  })
}

export type Viewer = { canEdit: boolean }

/**
 * Permissão de edição da interface. Sem banco conectado os formulários ficam
 * visíveis (o envio informa que falta configurar); com banco, só a equipe edita.
 */
export async function getViewer(): Promise<Viewer> {
  const result = await query<boolean>(false, async (supabase) => {
    const { data, error } = await supabase.rpc("is_staff")
    if (error) throw new Error(error.message)
    return Boolean(data)
  })
  return { canEdit: result.status === "unconfigured" ? true : result.data }
}

export type Access =
  | { state: "unconfigured" }
  | { state: "anonymous" }
  | { state: "pending"; email: string }
  | { state: "member"; role: "administrador" | "secretario" | "leitor" }

/**
 * Situação de acesso do usuário atual. Usuários autenticados mas ainda não
 * aprovados pelo administrador não veem nenhum dado (o RLS também bloqueia).
 */
export async function getAccess(): Promise<Access> {
  const result = await query<Access>({ state: "unconfigured" }, async (supabase) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { state: "anonymous" }
    const { data: profile } = await supabase.from("profiles").select("role, approved").eq("id", user.id).maybeSingle()
    if (!profile?.approved) return { state: "pending", email: user.email ?? "" }
    return { state: "member", role: profile.role }
  })
  return result.status === "error" ? { state: "anonymous" } : result.data
}
