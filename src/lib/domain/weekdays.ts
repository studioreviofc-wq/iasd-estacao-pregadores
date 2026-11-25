export const WEEKDAYS = [
  { value: 0, short: "Dom", label: "Domingo" },
  { value: 1, short: "Seg", label: "Segunda" },
  { value: 2, short: "Ter", label: "Terça" },
  { value: 3, short: "Qua", label: "Quarta" },
  { value: 4, short: "Qui", label: "Quinta" },
  { value: 5, short: "Sex", label: "Sexta" },
  { value: 6, short: "Sáb", label: "Sábado" },
] as const

export function weekdaysLabel(days: number[]) {
  if (!days.length) return null
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAYS[d]?.short).filter(Boolean).join(", ")
}
