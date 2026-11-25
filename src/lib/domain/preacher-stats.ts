import { differenceInCalendarDays } from "date-fns"

import { formatDate, fromISODate } from "./dates"

/** "há 12 dias", "há 3 meses", "há 1 ano" — a partir de hoje (fuso da igreja). */
export function timeSince(date: string, today: string): string {
  const days = differenceInCalendarDays(fromISODate(today), fromISODate(date))
  if (days <= 0) return "hoje"
  if (days === 1) return "ontem"
  if (days < 30) return `há ${days} dias`
  const months = Math.floor(days / 30.44)
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`
  const years = Math.floor(days / 365.25)
  return `há ${years} ${years === 1 ? "ano" : "anos"}`
}

export function daysSince(date: string | null, today: string): number | null {
  return date ? differenceInCalendarDays(fromISODate(today), fromISODate(date)) : null
}

export function availabilityLabel(start: string | null, end: string | null): string | null {
  if (!start || !end) return null
  return start === end ? formatDate(start, "dd/MM") : `${formatDate(start, "dd/MM")} a ${formatDate(end, "dd/MM")}`
}
