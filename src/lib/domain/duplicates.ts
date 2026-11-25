import { normalizeBrPhone, normalizeName } from "./phone"

export type DuplicateCandidate = {
  id: string
  full_name: string
  phone: string | null
  phone_normalized: string | null
  archived_at: string | null
}

export type DuplicateMatch = { id: string; full_name: string; phone: string | null; archived: boolean; reason: string }

function firstLast(name: string) {
  const parts = normalizeName(name).split(" ").filter((p) => p.length > 2)
  return parts.length >= 2 ? `${parts[0]} ${parts.at(-1)}` : null
}

/**
 * Possíveis cadastros duplicados: mesmo telefone (normalizado), mesmo nome
 * (sem acentos/maiúsculas) ou mesmo primeiro + último nome.
 */
export function findDuplicates(
  existing: DuplicateCandidate[],
  input: { full_name: string; phone: string | null | undefined; excludeId?: string | null }
): DuplicateMatch[] {
  const phone = normalizeBrPhone(input.phone)
  const name = normalizeName(input.full_name)
  const fl = firstLast(input.full_name)
  const out: DuplicateMatch[] = []

  for (const p of existing) {
    if (p.id === input.excludeId) continue
    const reasons: string[] = []
    if (phone && p.phone_normalized === phone) reasons.push("mesmo telefone")
    if (name && normalizeName(p.full_name) === name) reasons.push("mesmo nome")
    else if (fl && firstLast(p.full_name) === fl) reasons.push("nome parecido")
    if (reasons.length) {
      out.push({ id: p.id, full_name: p.full_name, phone: p.phone, archived: Boolean(p.archived_at), reason: reasons.join(" e ") })
    }
  }
  return out
}
