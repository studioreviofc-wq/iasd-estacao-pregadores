/**
 * Junta todas as migrações (em ordem) em supabase/setup.sql,
 * para instalar o banco colando um único arquivo no SQL Editor do Supabase.
 * Uso: npm run db:setup-sql
 */
import fs from "node:fs"
import path from "node:path"

const dir = new URL("../supabase/migrations/", import.meta.url).pathname
const out = new URL("../supabase/setup.sql", import.meta.url).pathname
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()

const parts = [
  "-- ============================================================================",
  "-- IASD Estação — instalação completa do banco (gerado por scripts/build-setup-sql.mjs)",
  "-- Cole TODO este arquivo no SQL Editor do Supabase e clique em Run (uma única vez,",
  "-- num projeto novo). Não edite à mão: altere as migrações e gere de novo.",
  `-- Migrações incluídas: ${files.length}`,
  "-- ============================================================================",
  "",
]
for (const f of files) {
  parts.push(`-- >>>>>>>>>> ${f}`, fs.readFileSync(path.join(dir, f), "utf8").trim(), "")
}
fs.writeFileSync(out, parts.join("\n"))
console.log(`supabase/setup.sql gerado com ${files.length} migrações.`)
