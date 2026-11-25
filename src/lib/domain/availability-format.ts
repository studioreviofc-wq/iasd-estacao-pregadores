import { formatDate } from "./dates"
import { weekdaysLabel } from "./weekdays"

/** "06/03, 20/03 · Sáb" · "Sáb, Dom" · "Qualquer dia do mês". */
export function availableDaysLabel(a: { specific_dates: string[]; weekdays: number[] }) {
  const parts: string[] = []
  if (a.specific_dates.length) parts.push(a.specific_dates.map((d) => formatDate(d, "dd/MM")).join(", "))
  const w = weekdaysLabel(a.weekdays)
  if (w) parts.push(w)
  return parts.length ? parts.join(" · ") : "Qualquer dia do mês"
}
