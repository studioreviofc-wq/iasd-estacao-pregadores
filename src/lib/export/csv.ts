/**
 * CSV compatível com Excel/LibreOffice em português:
 * separador ";", BOM UTF-8 (acentos corretos) e aspas quando necessário.
 */
export function toCsv<T>(rows: T[], columns: { header: string; value: (row: T) => unknown }[]): string {
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ""
    const s = String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [columns.map((c) => escape(c.header)).join(";")]
  for (const row of rows) lines.push(columns.map((c) => escape(c.value(row))).join(";"))
  return "﻿" + lines.join("\r\n") + "\r\n"
}

/** dd/MM/aaaa a partir de "aaaa-MM-dd". */
export function brDate(iso: string | null | undefined) {
  if (!iso) return ""
  const [y, m, d] = iso.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}
