"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ScheduleRange } from "@/lib/domain/dates"
import { cn } from "@/lib/utils"

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

function shiftKey(key: string, amount: number) {
  const [y, m] = key.split("-").map(Number)
  const d = new Date(y, m - 1 + amount, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function clamp(key: string, range: ScheduleRange) {
  return key < range.start ? range.start : key > range.end ? range.end : key
}

/**
 * Navegação entre meses (anterior/próximo) + seleção direta de mês e ano,
 * limitada à faixa da escala. Mantém os demais parâmetros da URL (visão, filtros).
 */
export function MonthPicker({ monthKey, range }: { monthKey: string; range: ScheduleRange }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const [year, month] = monthKey.split("-")
  const years: string[] = []
  for (let y = Number(range.start.slice(0, 4)); y <= Number(range.end.slice(0, 4)); y++) years.push(String(y))

  function go(key: string) {
    const next = new URLSearchParams(params)
    next.set("mes", clamp(key, range))
    next.delete("novo")
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }))
  }

  const prev = shiftKey(monthKey, -1)
  const nextKey = shiftKey(monthKey, 1)

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-card transition-opacity",
        pending && "opacity-70"
      )}
    >
      <Button variant="ghost" size="icon-sm" aria-label="Mês anterior" disabled={prev < range.start} onClick={() => go(prev)}>
        <ChevronLeft />
      </Button>

      <Select value={month} onValueChange={(m) => go(`${year}-${m}`)}>
        <SelectTrigger size="sm" className="h-7 w-[7.5rem] border-0 shadow-none" aria-label="Mês">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {MONTHS.map((label, i) => {
            const m = String(i + 1).padStart(2, "0")
            const key = `${year}-${m}`
            return (
              <SelectItem key={m} value={m} disabled={key < range.start || key > range.end}>
                {label}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      <Select value={year} onValueChange={(y) => go(`${y}-${month}`)}>
        <SelectTrigger size="sm" className="h-7 w-[5.5rem] border-0 shadow-none" aria-label="Ano">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {years.map((y) => (
            <SelectItem key={y} value={y}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="ghost" size="icon-sm" aria-label="Próximo mês" disabled={nextKey > range.end} onClick={() => go(nextKey)}>
        <ChevronRight />
      </Button>
    </div>
  )
}
