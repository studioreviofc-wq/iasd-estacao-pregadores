/**
 * Telefones brasileiros: validação, normalização e formatação.
 * A normalização espelha public.normalize_br_phone() no banco:
 * remove máscara, código do país (55) e zero de operadora → DDD + número.
 */

/** DDDs válidos no Brasil (Anatel). */
const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
])

/** Apenas DDD + número (10 ou 11 dígitos), ou `null` se o tamanho não fecha. */
export function normalizeBrPhone(raw: string | null | undefined): string | null {
  let d = (raw ?? "").replace(/\D/g, "")
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2)
  else if ((d.length === 11 || d.length === 12) && d.startsWith("0")) d = d.slice(1)
  return d.length === 10 || d.length === 11 ? d : null
}

/** Mensagem de erro em português, ou `null` se o telefone é válido. */
export function validateBrPhone(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return "Informe o telefone com DDD."
  const d = normalizeBrPhone(raw)
  if (!d) return "Telefone incompleto: use DDD + número, ex.: (82) 99999-9999."
  if (!VALID_DDDS.has(Number(d.slice(0, 2)))) return `DDD ${d.slice(0, 2)} não existe.`
  if (d.length === 11 && d[2] !== "9") return "Celular com 11 dígitos deve começar com 9 após o DDD."
  if (d.length === 10 && !"2345".includes(d[2])) return "Número fixo inválido. Para celular, inclua o 9."
  return null
}

/** (82) 99999-9999 ou (82) 3333-4444. */
export function formatBrPhone(raw: string | null | undefined): string {
  const d = normalizeBrPhone(raw)
  if (!d) return raw ?? ""
  return d.length === 11
    ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
}

export function isMobile(raw: string | null | undefined) {
  return normalizeBrPhone(raw)?.length === 11
}

/** Link wa.me com mensagem — apenas abre a conversa; nada é enviado automaticamente. */
export function whatsappUrl(raw: string | null | undefined, message?: string): string | null {
  const d = normalizeBrPhone(raw)
  if (!d) return null
  const text = message?.trim() ? `?text=${encodeURIComponent(message.trim())}` : ""
  return `https://wa.me/55${d}${text}`
}

/** Preenche {nome}, {primeiro_nome} e {igreja} no modelo de mensagem. */
export function renderWhatsappTemplate(template: string, vars: { nome: string; igreja: string }) {
  const first = vars.nome.trim().split(/\s+/)[0] ?? vars.nome
  return template
    .replaceAll("{nome}", vars.nome.trim())
    .replaceAll("{primeiro_nome}", first)
    .replaceAll("{igreja}", vars.igreja)
}

/** Nome para comparação: sem acentos, minúsculo, espaços simples. */
export function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
