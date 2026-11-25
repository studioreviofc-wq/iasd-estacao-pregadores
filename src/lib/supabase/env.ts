/**
 * Leitura centralizada das variáveis de ambiente do Supabase.
 * Enquanto não estiverem definidas, o sistema roda em "modo de configuração":
 * as telas exibem estados vazios e um aviso, sem dados fictícios.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabaseEnv = { url, key }

export function isSupabaseConfigured(): boolean {
  return Boolean(url && key)
}

export function requireSupabaseEnv() {
  if (!url || !key) {
    throw new Error(
      "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY em .env.local."
    )
  }
  return { url, key }
}
