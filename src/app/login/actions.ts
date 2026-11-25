"use server"

import { redirect } from "next/navigation"

import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

export type SignInState = { error?: string }

function safeRedirect(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : "/"
  return path.startsWith("/") && !path.startsWith("//") ? path : "/"
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  if (!isSupabaseConfigured()) return { error: "O banco de dados ainda não foi configurado." }

  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  if (!email || !password) return { error: "Informe e-mail e senha." }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: "E-mail ou senha inválidos." }

  redirect(safeRedirect(formData.get("redirect")))
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  redirect("/login")
}
