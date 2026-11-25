/** Nome para exibição: "Nome (apelido)" quando o apelido for diferente do nome. */
export function preacherDisplayName(p: { full_name: string; nickname?: string | null }) {
  const nick = p.nickname?.trim()
  return nick && nick.toLowerCase() !== p.full_name.trim().toLowerCase() ? `${p.full_name} (${nick})` : p.full_name
}
