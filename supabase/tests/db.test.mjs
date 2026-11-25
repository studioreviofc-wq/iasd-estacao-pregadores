import { PGlite } from "@electric-sql/pglite"
import fs from "node:fs"
import path from "node:path"

/**
 * Testa as migrações em um Postgres em memória (PGlite): estrutura, geração
 * das datas da escala, regras dos cultos e políticas RLS.
 * Uso: npm run test:db
 * O schema `auth` do Supabase é simulado (auth.users + auth.uid()).
 */
const dir = process.argv[2] ?? new URL("../migrations", import.meta.url).pathname
const db = new PGlite()

await db.exec(`
create role authenticated nologin;
create role anon nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
grant usage on schema public, auth to authenticated;
grant execute on function auth.uid() to authenticated;
`)

console.log("Migrações:")
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (f.startsWith("20261127")) {
    // Dados no formato anterior, para testar a conversão da etapa 5
    await db.exec(`
      insert into preachers (id, full_name, phone) values ('00000000-0000-4000-8000-0000000000aa', 'Legado Antigo', '(82) 97777-0000');
      insert into contact_logs (preacher_id, outcome) values
        ('00000000-0000-4000-8000-0000000000aa', 'recusado'), ('00000000-0000-4000-8000-0000000000aa', 'sem_resposta');
      insert into availabilities (preacher_id, start_date, end_date) values ('00000000-0000-4000-8000-0000000000aa', '2027-02-10', '2027-02-20');
    `)
  }
  await db.exec(fs.readFileSync(path.join(dir, f), "utf8"))
  console.log("  ✓", f)
}
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;`)

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------
let failures = 0
const ok = (m) => console.log("  ✓", m)
const fail = (m) => {
  console.log("  ✗", m)
  failures++
}
const check = (cond, m) => (cond ? ok(m) : fail(m))
const firstLine = (e) => e.message.split("\n")[0]

const A = "00000000-0000-0000-0000-00000000000a" // administrador
const R = "00000000-0000-0000-0000-00000000000b" // leitor
const U = "00000000-0000-0000-0000-00000000000c" // cadastrado, ainda não aprovado

async function as(uid, sql) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.sub','${uid}', true);`)
    return tx.query(sql)
  })
}
async function expectFail(fn, label) {
  try {
    await fn()
    fail(`deveria falhar: ${label}`)
  } catch (e) {
    ok(`${label} → ${firstLine(e)}`)
  }
}

/**
 * Cálculo independente (JavaScript, UTC) das datas esperadas:
 * sábado → sabado_manha, quarta → quarta_noite, domingo → domingo_noite.
 */
function expectedServices(start, end) {
  const byWeekday = { 6: "sabado_manha", 3: "quarta_noite", 0: "domingo_noite" }
  const out = []
  const d = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  for (; d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
    const type = byWeekday[d.getUTCDay()]
    if (type) out.push(`${d.toISOString().slice(0, 10)}|${type}`)
  }
  return out
}
const countServices = async () => (await db.query(`select count(*)::int as n from services`)).rows[0].n

// ---------------------------------------------------------------------------
console.log("\nGeração das datas (dez/2026 → dez/2027):")
// ---------------------------------------------------------------------------
const expected = expectedServices("2026-12-01", "2027-12-31")
const actual = (
  await db.query(`select service_date::text || '|' || service_type as k from services order by service_date, service_type`)
).rows.map((r) => r.k)

check(actual.length === expected.length, `${actual.length} cultos gerados (esperado ${expected.length})`)
const missing = expected.filter((k) => !actual.includes(k))
const extra = actual.filter((k) => !expected.includes(k))
check(missing.length === 0 && extra.length === 0, `datas idênticas ao cálculo independente (faltando ${missing.length}, sobrando ${extra.length})`)

const perMonth = (
  await db.query(`
    select to_char(service_date, 'YYYY-MM') as mes,
           count(*) filter (where service_type = 'sabado_manha')::int as sab,
           count(*) filter (where service_type = 'quarta_noite')::int as qua,
           count(*) filter (where service_type = 'domingo_noite')::int as dom
    from services group by 1 order by 1`)
).rows
check(perMonth.length === 13, `13 meses cobertos (${perMonth[0]?.mes} a ${perMonth.at(-1)?.mes})`)
console.log("    mês      sáb qua dom")
for (const m of perMonth) console.log(`    ${m.mes}   ${m.sab}   ${m.qua}   ${m.dom}`)

const dec = (
  await db.query(`
    select service_date::text as d, extract(dow from service_date)::int as dow, service_type, period
    from services where service_date < '2027-01-01' order by service_date`)
).rows
check(
  dec.map((r) => r.d.slice(8)).join(",") === "02,05,06,09,12,13,16,19,20,23,26,27,30",
  `dezembro/2026: ${dec.map((r) => r.d.slice(8)).join(", ")}`
)
check(
  dec.every((r) => ({ 6: "sabado_manha", 3: "quarta_noite", 0: "domingo_noite" })[r.dow] === r.service_type),
  "cada data cai no dia da semana correto"
)
check(
  dec.every((r) => r.period === (r.service_type === "sabado_manha" ? "manha" : "noite")),
  "períodos: sábado manhã, quarta e domingo noite"
)

const assigned = (await db.query(`select count(*)::int as n from services where preacher_id is not null or status <> 'aberto'`)).rows[0].n
check(assigned === 0, "todos os cultos nascem em aberto, sem pregador")

const tz = (await db.query(`select timezone, schedule_start::text s, schedule_end::text e from church_settings`)).rows[0]
check(tz.timezone === "America/Maceio", `fuso: ${tz.timezone}`)
check(tz.s === "2026-12-01" && tz.e === "2027-12-31", `faixa configurada: ${tz.s} a ${tz.e}`)

// ---------------------------------------------------------------------------
console.log("\nUsuários e permissões:")
// ---------------------------------------------------------------------------
await db.exec(
  `insert into auth.users (id, email, raw_user_meta_data) values ('${A}','admin@x.org','{"full_name":"Admin"}'), ('${R}','leitor@x.org','{}');`
)
const profiles = (await db.query(`select email, role from profiles order by email`)).rows
check(profiles.length === 2 && profiles.every((p) => p.role === "leitor"), "perfis criados como leitor pelo trigger")
const approvedDefault = (await db.query(`select bool_or(approved) a from profiles`)).rows[0].a
check(approvedDefault === false, "novos usuários começam sem acesso aprovado")
await db.exec(`update profiles set role='administrador', approved=true where id='${A}'; update profiles set approved=true where id='${R}';`)
check((await as(A, `select public.is_staff() as s`)).rows[0].s === true, "is_staff(admin) = true")

// ---------------------------------------------------------------------------
console.log("\nIdempotência e expansão:")
// ---------------------------------------------------------------------------
const before = await countServices()
const again = (await as(A, `select generate_regular_services('2026-12-01','2027-12-31') as n`)).rows[0].n
check(again === 0 && (await countServices()) === before, `gerar de novo cria ${again} cultos (total segue ${before})`)

const overlap = (await as(A, `select generate_regular_services('2027-06-01','2028-01-31') as n`)).rows[0].n
const expectedJan = expectedServices("2028-01-01", "2028-01-31").length
check(overlap === expectedJan, `faixa sobreposta cria só o que falta: ${overlap} (janeiro/2028 = ${expectedJan})`)

const y2028 = (await as(A, `select generate_regular_services('2028-01-01','2028-12-31') as n`)).rows[0].n
const expected2028 = expectedServices("2028-01-01", "2028-12-31").length
check(y2028 === expected2028 - expectedJan, `expansão para 2028 cria ${y2028} (ano bissexto, total esperado ${expected2028})`)
const feb29 = (await db.query(`select count(*)::int n from services where service_date = '2028-02-29'`)).rows[0].n
check(feb29 === 0, "29/02/2028 (terça-feira) corretamente sem culto")

await expectFail(() => as(R, `select generate_regular_services('2029-01-01','2029-01-31')`), "leitor não gera cultos")
await expectFail(() => as(A, `select generate_regular_services('2027-01-31','2027-01-01')`), "intervalo invertido rejeitado")

// ---------------------------------------------------------------------------
console.log("\nRegras dos cultos:")
// ---------------------------------------------------------------------------
await as(A, `insert into preachers (full_name, category, phone) values ('Pregador de Teste', 'pastor', '(82) 99999-0001')`)
const p = (await db.query(`select id from preachers where full_name='Pregador de Teste'`)).rows[0].id
const sat = (await db.query(`select id from services where service_date='2026-12-05'`)).rows[0].id

await expectFail(
  () => as(A, `insert into services (service_date, service_type) values ('2026-12-05','sabado_manha')`),
  "culto regular duplicado bloqueado"
)
await expectFail(
  () => as(A, `insert into services (service_date, service_type) values ('2026-12-07','sabado_manha')`),
  "culto de sábado numa segunda-feira bloqueado"
)
await expectFail(
  () => as(A, `update services set status='confirmado' where id='${sat}'`),
  "confirmado sem pregador bloqueado"
)
await as(A, `update services set status='confirmado', preacher_id='${p}' where id='${sat}'`)
ok("admin vincula e confirma pregador")
await as(A, `update services set status='aberto', preacher_id=null where id='${sat}'`)
ok("admin remove o vínculo (volta a em aberto)")

await expectFail(
  () => as(A, `insert into services (service_date, service_type, period) values ('2026-12-24','especial', null)`),
  "extraordinário sem período bloqueado"
)
await as(A, `insert into services (service_date, service_type, period, title) values ('2026-12-24','especial','noite','Culto de Natal')`)
await as(A, `insert into services (service_date, service_type, period, title) values ('2026-12-24','especial','manha','Programação matinal')`)
ok("dois cultos extraordinários no mesmo dia permitidos")

const delRegular = await as(A, `delete from services where id='${sat}' returning id`)
check(delRegular.rows.length === 0, "culto regular não pode ser excluído (0 linhas)")
await as(A, `update services set status='cancelado' where id='${sat}'`)
ok("culto regular pode ser cancelado")
const delSpecial = await as(A, `delete from services where service_type='especial' and period='manha' returning id`)
check(delSpecial.rows.length === 1, "culto extraordinário pode ser excluído")

// ---------------------------------------------------------------------------
console.log("\nRLS geral:")
// ---------------------------------------------------------------------------
check((await as(R, `select count(*)::int as n from services`)).rows[0].n > 0, "leitor lê a escala")
await expectFail(() => as(R, `insert into preachers (full_name, phone) values ('X', '82999990009')`), "leitor não insere pregador")
check((await as(R, `update services set notes='x' returning id`)).rows.length === 0, "leitor não altera cultos")
check((await as(R, `update church_settings set city='X' returning id`)).rows.length === 0, "leitor não altera configurações")
await expectFail(() => as(R, `update profiles set role='administrador' where id='${R}'`), "leitor não se promove")
check((await as(R, `update profiles set full_name='Novo' where id='${R}' returning id`)).rows.length === 1, "leitor edita o próprio nome")

// ---------------------------------------------------------------------------
console.log("\nTelefones:")
// ---------------------------------------------------------------------------
const phones = [
  ["(82) 99999-1234", "82999991234"],
  ["+55 82 99999-1234", "82999991234"],
  ["082 99999-1234", "82999991234"],
  ["82 3333-4444", "8233334444"],
  ["(55) 99999-1234", "55999991234"],
  ["123", null],
  ["", null],
]
for (const [raw, want] of phones) {
  const got = (await db.query(`select normalize_br_phone($1) as n`, [raw])).rows[0].n
  check(got === want, `"${raw}" → ${got}`)
}
const onlyName = (await as(A, `insert into preachers (full_name, nickname, home_church) values ('Teté', 'Teté', 'Central') returning id, phone_normalized`)).rows[0]
check(Boolean(onlyName.id) && onlyName.phone_normalized === null, "cadastro só com nome, apelido e igreja permitido (telefone opcional)")
const nick = (await as(R, `select nickname from preacher_overview where id='${onlyName.id}'`)).rows[0]
check(nick?.nickname === "Teté", "apelido disponível na visão consolidada")
await as(A, `delete from preachers where id='${onlyName.id}'`)
await expectFail(() => as(A, `insert into preachers (full_name, phone) values ('Telefone Curto', '9999')`), "telefone informado mas inválido continua bloqueado")
const norm = (await db.query(`select phone_normalized from preachers where id='${p}'`)).rows[0].phone_normalized
check(norm === "82999990001", `telefone salvo normalizado: ${norm}`)

// ---------------------------------------------------------------------------
console.log("\nHistórico e estatísticas do pregador:")
// ---------------------------------------------------------------------------
const today = (await db.query(`select church_today()::text as d`)).rows[0].d
const past = (await db.query(`select (church_today() - 20)::text as d`)).rows[0].d
const past2 = (await db.query(`select (church_today() - 50)::text as d`)).rows[0].d
await as(A, `insert into services (service_date, service_type, period, title, preacher_id, status) values ('${past2}','especial','noite','Culto antigo','${p}','convidado')`)
await as(A, `update services set status='realizado' where service_date='${past2}' and service_type='especial'`)
await as(A, `insert into services (service_date, service_type, period, title, preacher_id, status) values ('${past}','especial','noite','Culto recente','${p}','realizado')`)
await expectFail(
  () => as(A, `update services set preacher_id='${p}', status='realizado' where service_date='2026-12-19'`),
  "culto futuro não pode ser realizado"
)
await as(A, `update services set preacher_id='${p}', status='confirmado' where service_date='2026-12-19'`)
await as(A, `update services set preacher_id='${p}', status='confirmado' where service_date='2026-12-20'`)
await as(A, `update services set status='cancelado' where service_date='2026-12-20'`)
await as(A, `insert into contact_logs (preacher_id, channel, outcome) values ('${p}','whatsapp','indisponivel')`)
await as(A, `update services set preacher_id='${p}', status='convidado' where service_date='2026-12-23'`)
await as(A, `update services set preacher_id=null, status='aberto' where service_date='2026-12-23'`)

const ov = (await as(A, `select last_preached_on::text l, total_preached t, next_confirmed_on::text n from preacher_overview where id='${p}'`)).rows[0]
check(ov.t === 2, `total realizado = ${ov.t} (recusas, cancelamentos e futuros não contam)`)
check(ov.l === past, `última pregação = ${ov.l} (hoje ${today})`)
check(ov.n === "2026-12-19", `próxima confirmada = ${ov.n}`)

const ev = (await as(R, `select event_type from preacher_events where preacher_id='${p}' order by occurred_at, event_type`)).rows.map((r) => r.event_type)
check(
  ["escalado", "realizado", "confirmado", "cancelado", "desvinculado"].every((e) => ev.includes(e)),
  `eventos registrados: ${ev.join(", ")}`
)
await expectFail(() => as(A, `insert into preacher_events (preacher_id, service_date, service_type, period, event_type) values ('${p}','2026-12-01','especial','noite','realizado')`), "eventos não podem ser forjados pelo app")

const h = (await as(A, `select preacher_name from preaching_history`)).rows
check(h.length === 2, "histórico mostra os cultos realizados")

// ---------------------------------------------------------------------------
console.log("\nIntegridade:")
// ---------------------------------------------------------------------------
await expectFail(() => as(A, `delete from preachers where id='${p}'`), "pregador com histórico não pode ser excluído")
await as(A, `update preachers set archived_at = now(), is_active = true where id='${p}'`)
const arch = (await db.query(`select is_active from preachers where id='${p}'`)).rows[0].is_active
check(arch === false, "arquivar desativa o pregador")
check((await as(A, `select count(*)::int n from preaching_history`)).rows[0].n === 2, "histórico preservado após arquivar")
await as(A, `insert into preachers (full_name, phone) values ('Sem Histórico', '(82) 3333-0000')`)
const del = await as(A, `delete from preachers where full_name='Sem Histórico' returning id`)
check(del.rows.length === 1, "pregador sem histórico pode ser excluído")

// ---------------------------------------------------------------------------
console.log("\nContatos:")
// ---------------------------------------------------------------------------
await as(A, `update preachers set archived_at = null, is_active = true where id='${p}'`)
await as(A, `insert into preachers (full_name, phone) values ('Segundo Pregador', '(82) 98888-0002')`)
const q = (await db.query(`select id from preachers where full_name='Segundo Pregador'`)).rows[0].id

const statuses = (await db.query(`select unnest(enum_range(null::contact_status))::text s`)).rows.map((r) => r.s)
check(
  statuses.join(",") === "nao_contatado,aguardando,aceito,indisponivel,outro_mes,novo_contato",
  `status de contato: ${statuses.join(", ")}`
)
const migrated = (await db.query(`select outcome::text o from contact_logs where preacher_id='00000000-0000-4000-8000-0000000000aa' order by o`)).rows.map((r) => r.o)
check(migrated.join(",") === "indisponivel,novo_contato", `contatos antigos convertidos: recusado/sem resposta → ${migrated.join(", ")}`)
const legacyAv = (await db.query(`select availability_month::text m, status::text s from availabilities where preacher_id='00000000-0000-4000-8000-0000000000aa'`)).rows[0]
check(legacyAv.m === "2027-02-01" && legacyAv.s === "informada", `disponibilidade antiga ganhou mês ${legacyAv.m} e status ${legacyAv.s}`)

const first = (await as(A, `insert into contact_logs (preacher_id, channel, outcome, invited_for_month, contacted_at, follow_up_on)
  values ('${q}','whatsapp','aguardando','2027-01-01', now() - interval '2 days', church_today()) returning id`)).rows[0].id
await as(A, `insert into contact_logs (preacher_id, channel, outcome, invited_for_month, previous_id, contacted_at)
  values ('${q}','telefone','outro_mes','2027-01-01','${first}', now())`)
const latest = (await as(R, `select outcome::text o, previous_id from contact_latest where preacher_id='${q}'`)).rows[0]
check(latest.o === "outro_mes" && latest.previous_id === first, "situação atual = último contato, ligado ao anterior")
check((await as(A, `select count(*)::int n from contact_logs where preacher_id='${q}'`)).rows[0].n === 2, "nova interação não sobrescreve a anterior")
check((await as(A, `update contact_logs set outcome='aceito' where id='${first}' returning id`)).rows.length === 0, "histórico de contatos não pode ser alterado")
await expectFail(() => as(A, `insert into contact_logs (preacher_id, invited_for_month) values ('${q}','2027-01-15')`), "mês do convite deve ser o 1º dia")

// ---------------------------------------------------------------------------
console.log("\nDisponibilidades:")
// ---------------------------------------------------------------------------
const av1 = (await as(A, `insert into availabilities (preacher_id, availability_month, weekdays) values ('${q}','2027-01-01','{6,0}') returning id, start_date::text s, end_date::text e, weekdays`)).rows[0]
check(av1.s === "2027-01-01" && av1.e === "2027-01-31", `mês inteiro → ${av1.s} a ${av1.e}`)
check(JSON.stringify(av1.weekdays) === "[0,6]", "dias da semana ordenados")
const av2 = (await as(A, `insert into availabilities (preacher_id, availability_month, specific_dates) values ('${q}','2027-03-01','{2027-03-20,2027-03-06}') returning id, start_date::text s, end_date::text e`)).rows[0]
check(av2.s === "2027-03-06" && av2.e === "2027-03-20", `datas específicas → ${av2.s} a ${av2.e}`)
await expectFail(
  () => as(A, `insert into availabilities (preacher_id, availability_month, specific_dates) values ('${q}','2027-03-01','{2027-04-03}')`),
  "data específica fora do mês bloqueada"
)
check((await as(A, `select count(*)::int n from availabilities where preacher_id='${q}'`)).rows[0].n === 2, "mais de um mês por pregador")

const cov = (await db.query(`select
  availability_covers('2027-01-01','2027-01-31','{}','{6,0}','2027-01-02') sab,
  availability_covers('2027-01-01','2027-01-31','{}','{6,0}','2027-01-06') qua,
  availability_covers('2027-03-06','2027-03-20','{2027-03-06,2027-03-20}','{}','2027-03-13') fora`)).rows[0]
check(cov.sab && !cov.qua && !cov.fora, "cobertura respeita dias da semana e datas específicas")

const view = (await as(R, `select effective_status::text s, preacher_name, last_contacted_at is not null c from availability_overview where id='${av1.id}'`)).rows[0]
check(view.s === "informada" && view.preacher_name === "Segundo Pregador" && view.c, "visão com status, pregador e último contato")
await as(A, `insert into availabilities (preacher_id, availability_month) values ('${q}', date_trunc('month', church_today() - 62)::date)`)
const expired = (await as(R, `select count(*)::int n from availability_overview where preacher_id='${q}' and effective_status='expirada'`)).rows[0].n
check(expired === 1, "disponibilidade passada aparece como expirada")

// ---------------------------------------------------------------------------
console.log("\nEscala ↔ disponibilidade:")
// ---------------------------------------------------------------------------
const wed = (await db.query(`select id from services where service_date='2027-01-06'`)).rows[0].id // quarta
const sat9 = (await db.query(`select id from services where service_date='2027-01-09'`)).rows[0].id // sábado
await as(A, `update services set preacher_id='${q}', status='confirmado' where id='${wed}'`)
const avAfterWed = (await db.query(`select status::text s from availabilities where id='${av1.id}'`)).rows[0].s
check(avAfterWed === "informada", "culto fora dos dias informados não consome a disponibilidade")
await as(A, `update services set preacher_id=null, status='aberto' where id='${wed}'`)

await as(A, `update services set preacher_id='${q}', status='convidado' where id='${sat9}'`)
let avs = (await db.query(`select status::text s, service_id from availabilities where id='${av1.id}'`)).rows[0]
check(avs.s === "aguardando_confirmacao" && avs.service_id === sat9, "convite → aguardando nova confirmação")
await as(A, `update services set status='confirmado' where id='${sat9}'`)
avs = (await db.query(`select status::text s from availabilities where id='${av1.id}'`)).rows[0]
check(avs.s === "agendado", "escala confirmada → disponibilidade agendada")
const created = (await db.query(`select count(*)::int n from services where preacher_id='${q}'`)).rows[0].n
check(created === 1, "disponibilidade não cria cultos sozinha")
await as(A, `update services set preacher_id=null, status='aberto' where id='${sat9}'`)
avs = (await db.query(`select status::text s, service_id from availabilities where id='${av1.id}'`)).rows[0]
check(avs.s === "informada" && avs.service_id === null, "culto reaberto → disponibilidade volta a informada")
const avEvents = (await as(R, `select coalesce(from_status::text,'—') || '→' || to_status::text t from availability_events where availability_id='${av1.id}' order by occurred_at, id`)).rows.map((r) => r.t)
check(avEvents.length >= 4, `histórico da disponibilidade preservado: ${avEvents.join(", ")}`)
const orig = (await db.query(`select availability_month::text m, weekdays from availabilities where id='${av1.id}'`)).rows[0]
check(orig.m === "2027-01-01" && JSON.stringify(orig.weekdays) === "[0,6]", "dados originais da disponibilidade intactos")
await expectFail(() => as(A, `insert into availability_events (availability_id, preacher_id, to_status) values ('${av1.id}','${q}','agendado')`), "eventos de disponibilidade não podem ser forjados")

// ---------------------------------------------------------------------------
console.log("\nRotatividade e conflitos:")
// ---------------------------------------------------------------------------
const rp = (await as(A, `insert into preachers (full_name, phone) values ('Rotação Teste', '(82) 96666-0001') returning id`)).rows[0].id
const nov = (await db.query(`select (date_trunc('month', church_today()) - interval '1 month')::date + 6 as d`)).rows[0].d
// Culto realizado no mês passado + confirmado em 05/12 e convidado em 26/12
await as(A, `insert into services (service_date, service_type, period, title, preacher_id, status) values ('${nov.toISOString().slice(0, 10)}','especial','noite','Passado','${rp}','realizado')`)
await as(A, `update services set preacher_id='${rp}', status='confirmado' where service_date='2026-12-05'`)
await as(A, `update services set preacher_id='${rp}', status='convidado' where service_date='2026-12-26'`)

const snap = (await as(A, `select * from rotation_snapshot('2026-12-12','manha', null) where preacher_id='${rp}'`)).rows[0]
check(snap.last_before.toISOString().slice(0, 10) === "2026-12-05", "última escala antes da data do culto (não de hoje)")
check(snap.next_after.toISOString().slice(0, 10) === "2026-12-26", "próxima escala depois do culto")
check(snap.month_count === 2, `escalas no mês do culto: ${snap.month_count}`)
check(snap.conflict === false && snap.same_day_other === false, "sem conflito em 12/12")
const snapJan = (await as(A, `select * from rotation_snapshot('2027-01-09','manha', null) where preacher_id='${rp}'`)).rows[0]
check(snapJan.prev_month_count === 1, "confirmado no mês anterior detectado (alerta de meses consecutivos)")
const snapSame = (await as(A, `select * from rotation_snapshot('2026-12-05','manha', null) where preacher_id='${rp}'`)).rows[0]
check(snapSame.conflict === true, "conflito no mesmo dia e período detectado")
const snapExcl = (await as(A, `select * from rotation_snapshot('2026-12-05','manha', (select id from services where service_date='2026-12-05')) where preacher_id='${rp}'`)).rows[0]
check(snapExcl.conflict === false, "o próprio culto em edição é ignorado")
const never = (await as(A, `select last_before from rotation_snapshot('2026-12-12','manha', null) where preacher_id='${q}'`)).rows[0]
check(never.last_before === null, "pregador sem escalas anteriores = nunca pregou")

await as(A, `insert into services (service_date, service_type, period, title) values ('2026-12-05','especial','manha','Simultâneo')`)
await expectFail(
  () => as(A, `update services set preacher_id='${rp}', status='convidado' where service_date='2026-12-05' and service_type='especial'`),
  "escala simultânea (mesmo dia e período) bloqueada"
)
await as(A, `insert into services (service_date, service_type, period, title, preacher_id, status) values ('2026-12-05','especial','noite','Mesmo dia à noite','${rp}','convidado')`)
ok("mesmo dia em outro período é permitido (apenas alerta)")
const settings = (await db.query(`select min_interval_days, consecutive_month_alert from church_settings`)).rows[0]
check(settings.min_interval_days === 30 && settings.consecutive_month_alert === true, "configuração padrão: intervalo 30 dias e alerta de meses consecutivos")

// ---------------------------------------------------------------------------
console.log("\nAcesso e privacidade:")
// ---------------------------------------------------------------------------
await db.exec(`insert into auth.users (id, email) values ('${U}','novo@x.org')`)
check((await as(U, `select count(*)::int n from preachers`)).rows[0].n === 0, "usuário não aprovado não vê pregadores nem telefones")
check((await as(U, `select count(*)::int n from services`)).rows[0].n === 0, "usuário não aprovado não vê a escala")
check((await as(U, `select count(*)::int n from contact_logs`)).rows[0].n === 0, "usuário não aprovado não vê contatos")
check((await as(U, `select count(*)::int n from profiles`)).rows[0].n === 1, "usuário não aprovado vê apenas o próprio perfil")
await expectFail(() => as(U, `update profiles set approved=true where id='${U}'`), "usuário não pode se autoaprovar")
await expectFail(() => as(U, `insert into preachers (full_name, phone) values ('Invasor Teste', '(82) 95555-0001')`), "usuário não aprovado não grava")
check((await as(U, `select public.is_staff() s`)).rows[0].s === false, "is_staff() exige aprovação")
await db.exec(`update profiles set approved=true where id='${U}'`)
check((await as(U, `select count(*)::int n from preachers`)).rows[0].n > 0, "após aprovação, o usuário passa a ler")
const anonPrivs = (await db.query(`select count(*)::int n from information_schema.role_table_grants where grantee='anon' and table_schema='public'`)).rows[0].n
check(anonPrivs === 0, "papel anônimo sem nenhum privilégio nas tabelas")

// ---------------------------------------------------------------------------
console.log("\nRegistro de alterações:")
// ---------------------------------------------------------------------------
await as(A, `update preachers set notes='Atualizado' where id='${rp}'`)
const audit = (await as(A, `select action, changes from audit_log where table_name='preachers' and record_id='${rp}' order by id`)).rows
check(audit[0]?.action === "insert" && audit.at(-1)?.action === "update", `alterações de pregador registradas (${audit.length})`)
check(JSON.stringify(audit.at(-1)?.changes) === JSON.stringify({ notes: [null, "Atualizado"] }), "update registra apenas o que mudou (antes → depois)")
const svcAudit = (await as(A, `select count(*)::int n from audit_log where table_name='services' and action='update'`)).rows[0].n
check(svcAudit > 0, "mudanças na escala registradas")
check((await as(R, `select count(*)::int n from audit_log`)).rows[0].n === 0, "somente o administrador lê o registro de alterações")
await expectFail(() => as(A, `insert into audit_log (table_name, action, changes) values ('x','insert','{}')`), "registro de alterações não pode ser forjado")

console.log(failures ? `\nFALHOU: ${failures} verificação(ões).` : "\nTodos os testes passaram.")
process.exitCode = failures ? 1 : 0
