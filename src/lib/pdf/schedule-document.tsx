import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"

import type { ServicePeriod, ServiceStatus, ServiceType } from "@/types/database"

/**
 * Documento PDF da escala mensal (A4 retrato).
 * Usa as fontes padrão do PDF (Helvetica), que cobrem a acentuação do português.
 */

const C = {
  brand: "#005579",
  brandDark: "#003B55",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  zebra: "#F8FAFC",
  red: "#DC2626",
}

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 10, color: C.text },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: C.brand },
  logo: { width: 54, height: 54, objectFit: "contain" },
  mark: { width: 54, height: 54, borderRadius: 8, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  markText: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 13, letterSpacing: 1 },
  church: { fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.brandDark, marginTop: 2 },
  month: { marginLeft: "auto", alignItems: "flex-end" },
  monthName: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.brand },
  year: { fontSize: 12, color: C.muted },
  table: { marginTop: 18, borderWidth: 1, borderColor: C.border, borderRadius: 4 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, minHeight: 26, alignItems: "center" },
  headRow: { backgroundColor: C.brand, borderBottomWidth: 0 },
  headCell: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.4 },
  cell: { paddingVertical: 6, paddingHorizontal: 8 },
  cDate: { width: "13%" },
  cDay: { width: "19%" },
  cPeriod: { width: "24%" },
  cPreacher: { width: "44%" },
  date: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  preacher: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  pending: { color: C.muted, fontFamily: "Helvetica-Oblique" },
  cancelled: { color: C.red, fontFamily: "Helvetica-Oblique" },
  sub: { fontSize: 8, color: C.muted, marginTop: 1 },
  empty: { padding: 24, textAlign: "center", color: C.muted },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: C.muted,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
  },
})

export type SchedulePdfRow = {
  date: string // dd/MM
  weekday: string
  period: ServicePeriod
  periodLabel: string
  serviceType: ServiceType
  serviceName: string
  /** Programação ou observação do culto (ex.: Desbravadores, Todos na Central). */
  program?: string | null
  preacher: string | null
  theme: string | null
  status: ServiceStatus
}

export type SchedulePdfProps = {
  churchName: string
  monthName: string
  year: string
  rows: SchedulePdfRow[]
  generatedAt: string
  logo?: Buffer | null
  notice?: string | null
}

export function ScheduleDocument({ churchName, monthName, year, rows, generatedAt, logo, notice }: SchedulePdfProps) {
  return (
    <Document title={`Escala de pregações — ${monthName} de ${year}`} author={churchName} language="pt-BR">
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          {logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não aceita alt
            <Image src={logo} style={styles.logo} />
          ) : (
            <View style={styles.mark}>
              <Text style={styles.markText}>IASD</Text>
            </View>
          )}
          <View>
            <Text style={styles.church}>{churchName}</Text>
            <Text style={styles.title}>Escala de Pregações</Text>
          </View>
          <View style={styles.month}>
            <Text style={styles.monthName}>{monthName}</Text>
            <Text style={styles.year}>{year}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headRow]} fixed>
            <Text style={[styles.cell, styles.cDate, styles.headCell]}>Data</Text>
            <Text style={[styles.cell, styles.cDay, styles.headCell]}>Dia da semana</Text>
            <Text style={[styles.cell, styles.cPeriod, styles.headCell]}>Período</Text>
            <Text style={[styles.cell, styles.cPreacher, styles.headCell]}>Pregador</Text>
          </View>

          {rows.length === 0 ? (
            <Text style={styles.empty}>{notice ?? "Nenhum culto cadastrado para este mês."}</Text>
          ) : (
            rows.map((r, i) => (
              <View
                key={`${r.date}-${r.period}-${i}`}
                style={[styles.row, { backgroundColor: i % 2 ? C.zebra : "#FFFFFF" }, i === rows.length - 1 ? { borderBottomWidth: 0 } : {}]}
                wrap={false}
              >
                <Text style={[styles.cell, styles.cDate, styles.date]}>{r.date}</Text>
                <Text style={[styles.cell, styles.cDay]}>{r.weekday}</Text>
                <View style={[styles.cell, styles.cPeriod]}>
                  <Text>{r.periodLabel}</Text>
                  {r.program ? <Text style={styles.sub}>{r.program}</Text> : null}
                </View>
                <View style={[styles.cell, styles.cPreacher]}>
                  {r.status === "cancelado" ? (
                    <Text style={styles.cancelled}>Culto cancelado</Text>
                  ) : r.preacher ? (
                    <Text style={styles.preacher}>{r.preacher}</Text>
                  ) : (
                    <Text style={styles.pending}>A definir</Text>
                  )}
                  {r.theme && r.status !== "cancelado" ? <Text style={styles.sub}>Tema: {r.theme}</Text> : null}
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {churchName} · Gerado em {generatedAt}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
