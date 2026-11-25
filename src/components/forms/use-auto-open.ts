"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * Atalho `?novo=1` (ações rápidas do dashboard): indica se o formulário de
 * criação deve abrir ao carregar e devolve uma função que limpa o parâmetro.
 */
export function useAutoOpen() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const requested = params.get("novo") === "1"

  function clear() {
    if (!requested) return
    const next = new URLSearchParams(params)
    next.delete("novo")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return { requested, clear }
}
