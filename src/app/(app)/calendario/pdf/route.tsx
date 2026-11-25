import { renderToBuffer } from "@react-pdf/renderer"
import type { NextRequest } from "next/server"

import { siteConfig } from "@/config/site"
import { listServicesForMonth } from "@/lib/data/services"
import { getScheduleRange, getSettings } from "@/lib/data/settings"
import { capitalize, formatDate, resolveMonthInRange, weekdayOf } from "@/lib/domain/dates"
import { serviceName, servicePeriodLabel } from "@/lib/domain/labels"
import { loadPdfLogo } from "@/lib/pdf/logo"
import { ScheduleDocument } from "@/lib/pdf/schedule-document"

/**
 * GET /calendario/pdf?mes=yyyy-MM[&download=1]
 * Escala mensal em PDF: abre no navegador para imprimir ou baixa o arquivo.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const range = await getScheduleRange()
  const month = resolveMonthInRange(params.get("mes") ?? undefined, range)

  const [services, settings, logo] = await Promise.all([listServicesForMonth(month), getSettings(), loadPdfLogo()])

  const rows = services.data.map((s) => ({
    date: formatDate(s.service_date, "dd/MM"),
    weekday: weekdayOf(s.service_date),
    period: s.period,
    periodLabel: servicePeriodLabel[s.period],
    serviceType: s.service_type,
    serviceName: serviceName(s),
    preacher: s.preacher?.full_name ?? null,
    theme: s.sermon_title,
    status: s.status,
  }))

  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: siteConfig.timezone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date())

  const notice =
    services.status === "unconfigured"
      ? "Banco de dados não configurado — a escala aparecerá aqui após a conexão."
      : services.status === "error"
        ? `Não foi possível carregar a escala: ${services.message}`
        : null

  const buffer = await renderToBuffer(
    <ScheduleDocument
      churchName={settings.data.settings?.church_name ?? siteConfig.churchName}
      monthName={capitalize(formatDate(month.start, "MMMM"))}
      year={month.key.slice(0, 4)}
      rows={rows}
      generatedAt={generatedAt}
      logo={logo}
      notice={notice}
    />
  )

  const filename = `escala-pregacoes-${month.key}.pdf`
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${params.get("download") ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
