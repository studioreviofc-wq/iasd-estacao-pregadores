# IASD Estação — Gestão de Pregadores

Sistema web para organizar as escalas de pregação da **Igreja Adventista do Sétimo Dia da Estação**: cadastro de pregadores, escala mensal, controle de contatos, disponibilidades futuras e histórico de pregações.

> **Status:** etapas 1 a 6 concluídas — arquitetura, calendário e escalas (dez/2026 → dez/2027), cadastro e histórico de pregadores, contatos e disponibilidades, rotatividade inteligente, segurança, auditoria, exportações e backup.
> Veja **[Pendências do administrador](#pendências-do-administrador)** para o que ainda precisa ser feito fora do código.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components, Partial Prerendering, `proxy.ts`) |
| Linguagem | TypeScript (strict) |
| Estilo | Tailwind CSS 4 + tokens CSS em `src/app/globals.css` |
| Componentes | shadcn/ui (base Radix, estilo *nova*) |
| Ícones | Lucide |
| Tipografia | Geist / Geist Mono (`next/font`) |
| Banco e Auth | Supabase (Postgres + RLS + Auth) via `@supabase/ssr` |
| Datas | date-fns (locale pt-BR), fuso `America/Maceio` |
| PDF | `@react-pdf/renderer` (gerado no servidor) |
| Testes | PGlite (Postgres em memória) + tsx |

---

## Instalação

Requisitos: **Node.js 20 ou superior** e npm.

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

Sem as variáveis do Supabase o sistema abre em **modo de configuração**: telas vazias com aviso, nenhum dado
fictício e nenhum dado real (não há banco). Serve apenas para conferir a interface.

### Variáveis de ambiente

| Variável | Onde obter | Observação |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | pública por natureza |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → *Publishable key* (`sb_publishable_…`) | pública por natureza; a segurança é feita pelo RLS. Projetos antigos podem usar `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

**Nunca** coloque a *secret key* / `service_role` em variáveis `NEXT_PUBLIC_*` nem no código: o sistema não precisa dela.
Arquivos `.env*` são ignorados pelo Git (exceto `.env.example`).

---

## Configuração do Supabase

1. **Criar o projeto** em [supabase.com](https://supabase.com) (região São Paulo recomendada).
2. **Aplicar as migrações, em ordem** — escolha uma forma:
   - **SQL Editor:** cole e execute, um por vez e nesta ordem, os arquivos de `supabase/migrations/`:
     1. `20261124000000_initial_schema.sql` — tabelas, enums, RLS base
     2. `20261124000001_profiles_email.sql` — e-mail no perfil
     3. `20261125000000_regular_schedule.sql` — períodos, faixa do calendário, **gera os 169 cultos de dez/2026 a dez/2027**
     4. `20261126000000_preacher_registry.sql` — telefone normalizado, arquivamento, eventos, `preacher_overview`
     5. `20261127000000_contacts_availability.sql` — status de contato, disponibilidades por mês, sincronização com a escala
     6. `20261128000000_rotation_security_audit.sql` — rotatividade, conflitos, aprovação de usuários, auditoria
   - **CLI:** `npx supabase login`, `npx supabase link --project-ref <ref>` e `npx supabase db push`.
3. **Autenticação** (Authentication → Sign In / Providers):
   - Mantenha **Email** habilitado.
   - **Desative “Allow new users to sign up”** (cadastro público). Os usuários são criados pelo administrador.
   - Em *URL Configuration*, defina o **Site URL** com o endereço publicado (ex.: `https://escala.seudominio.org`).
4. **Criar o primeiro administrador:** Authentication → Users → *Add user → Create new user* (marque *Auto Confirm User*), depois no SQL Editor:
   ```sql
   update public.profiles
   set role = 'administrador', approved = true, approved_at = now(), full_name = 'Nome do administrador'
   where id = (select id from auth.users where email = 'email-do-admin@exemplo.org');
   ```
5. Preencha `.env.local`, reinicie (`npm run dev`) e entre em `/login`.
6. Em **Configurações**, revise os dados da igreja, o período do calendário, o intervalo mínimo entre pregações e a mensagem do WhatsApp.

**Novos usuários:** crie em Authentication → Users e libere em **Configurações → Usuários e permissões** (chave *Acesso* + papel).
Até serem liberados, eles veem apenas a tela “Acesso aguardando aprovação” — o banco não devolve nenhum dado.

| Papel | Pode |
| --- | --- |
| Administrador | tudo, inclusive usuários, configurações, registro de alterações e backup |
| Secretário(a) | cadastrar/editar pregadores, escala, contatos e disponibilidades; exportar CSV |
| Leitura | consultar telas e exportar o histórico |

---

## Publicação (deploy)

Recomendado: **Vercel** (suporte nativo a Next.js 16).

1. Envie o projeto para um repositório Git (GitHub, GitLab…).
2. Na Vercel: *Add New Project* → importe o repositório (framework detectado: Next.js).
3. Em *Environment Variables*, cadastre `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Production e Preview).
4. Deploy. Depois, atualize o **Site URL** no Supabase com o domínio final.

Outras opções: qualquer host Node (`npm run build` + `npm start`, porta 3000) ou container. O sistema não usa banco local
nem arquivos gravados em disco.

Antes de publicar, rode `npm test`, `npm run lint` e `npm run build`.

---

## Segurança e privacidade

- **Login obrigatório**: com o Supabase configurado, `src/proxy.ts` redireciona tudo para `/login` (inclusive PDFs e exportações).
- **Aprovação de acesso**: usuários novos não leem nada até o administrador liberar (`profiles.approved`). Todas as
  políticas de leitura usam `is_member()`; escrita exige `is_staff()` (administrador/secretário aprovado).
- **Telefones e dados pessoais**: visíveis apenas para usuários aprovados; o papel anônimo não tem privilégio em nenhuma tabela.
  O CSV de pregadores só é exportado por administração/secretaria e o backup só pelo administrador.
- **Integridade**: pregadores com histórico não podem ser excluídos (`on delete restrict`); contatos não podem ser
  editados (cada resposta é um novo registro); conflitos de escala simultânea são bloqueados pelo banco.
- **Registro de alterações**: `audit_log` guarda criações, alterações (antes → depois) e exclusões de pregadores, escala,
  contatos, disponibilidades, configurações e usuários. Visível ao administrador em Configurações. Somente triggers escrevem.
- **Cabeçalhos HTTP**: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `HSTS`, `X-Robots-Tag: noindex` e sem `X-Powered-By`.
- **WhatsApp**: o botão apenas abre `wa.me` com a mensagem; nada é enviado automaticamente.

---

## Rotatividade de pregadores

Ao escolher um pregador para um culto, o sistema consulta o banco (`rotation_snapshot(data, período)`) e avalia,
**sempre em relação à data do culto** (não à data de hoje): última pregação realizada, escalas confirmadas anteriores
e futuras, escalas no mesmo mês, mês anterior, disponibilidade informada e conflitos de data.

| Situação | Classificação |
| --- | --- |
| Nunca pregou | prioridade alta |
| Última pregação há 90 dias ou mais | prioridade alta |
| 60 a 89 dias | disponível |
| 30 a 59 dias | pregação recente |
| Menos que o intervalo mínimo (padrão 30 dias) — antes **ou depois** do culto | evitar repetição → **alerta** |
| Pregou ou está confirmado no mês anterior (se a regra estiver ativa) | alerta de repetição → **alerta** |
| Já escalado no mesmo dia e período | **conflito — bloqueado** (também pelo banco) |

- Alertas **não bloqueiam**: o sistema mostra os motivos e pede “Entendo — escalar mesmo assim”. Vale no modal do culto,
  em “Vincular a culto” (disponibilidades) e em contatos aceitos para um culto específico. A checagem é refeita no servidor.
- Intervalo mínimo e regra de meses consecutivos ficam em **Configurações → Rotatividade de pregadores**.

**Sugestão inteligente** (modal do culto): ordena os pregadores ativos por (1) disponibilidade informada para o mês,
(2) disponibilidade/preferência pelo dia da semana, (3) nunca pregou, (4) mais tempo sem pregar, (5) sem outras
escalas no mês — conflitos no fim e alertas depois dos demais — e mostra o **motivo** de cada sugestão.
Nada é escalado nem confirmado automaticamente. Regras em `src/lib/domain/rotation.ts`.

---

## Backup e exportação

| Exportação | Onde | Quem |
| --- | --- | --- |
| Cadastro de pregadores (CSV) | Pregadores → *Exportar CSV* · `/exportar/pregadores` | administração e secretaria |
| Histórico de pregações (CSV) | Histórico → *Exportar CSV* · `/exportar/historico` | todos os usuários aprovados |
| Escala mensal (PDF) | Calendário → *Imprimir* / *PDF* · `/calendario/pdf?mes=aaaa-mm` | todos os usuários aprovados |
| Backup completo (JSON) | Configurações → *Backup completo* · `/exportar/backup` | administrador |

Os CSV usam `;` e UTF-8 com BOM (abrem corretamente no Excel em português). O backup traz todas as tabelas
(configurações, usuários, pregadores, cultos, disponibilidades, contatos e eventos) em páginas de 1000 linhas.
Recomenda-se também ativar os **backups automáticos do Supabase** (planos pagos) ou baixar o JSON periodicamente.

---

## Pendências do administrador

Itens que dependem de ações fora do código:

1. **Criar o projeto Supabase**, aplicar as 6 migrações e configurar a autenticação (seção *Configuração do Supabase*).
2. **Criar o primeiro administrador** e liberar os demais usuários.
3. **Preencher `.env.local`** (desenvolvimento) e as variáveis na hospedagem (produção).
4. **Logotipo oficial**: salvar em `public/brand/` (SVG para a tela e **PNG** para o PDF) e definir `logoSrc` e
   `pdfLogoSrc` em `src/config/site.ts`. Enquanto isso, aparece um símbolo provisório neutro.
5. **Cadastrar os pregadores de dezembro/2026** e vinculá-los às datas já criadas no calendário.
6. **Publicar** (Vercel ou outro host) e definir o domínio/Site URL.
7. Opcional: recuperação de senha pelo próprio sistema não foi implementada — o administrador redefine senhas em
   Supabase → Authentication → Users.

---

## Estrutura de pastas

```
src/
├── app/
│   ├── layout.tsx              # Fontes Geist, metadados, TooltipProvider
│   ├── globals.css             # Design system (tokens de marca → tokens semânticos)
│   ├── login/                  # Página de login + Server Actions (signIn / signOut)
│   ├── exportar/               # Rotas de download: pregadores.csv, historico.csv, backup.json
│   └── (app)/                  # Área autenticada (sidebar + cabeçalho)
│       │                       # cada rota tem page.tsx (leitura) + actions.ts (mutações)
│       ├── layout.tsx          # SidebarProvider (estado salvo em cookie)
│       ├── page.tsx            # Visão geral (dashboard)
│       ├── calendario/         # Escala mensal (grade no desktop, lista no mobile)
│       ├── pregadores/
│       ├── disponibilidades/
│       ├── contatos/
│       ├── historico/
│       └── configuracoes/
├── components/
│   ├── ui/                     # Primitivos shadcn/ui (não editar sem necessidade)
│   ├── layout/                 # AppSidebar, AppHeader, BrandMark, SidebarUser
│   ├── shared/                 # PageHeader, StatCard, StatusBadge, EmptyState,
│   │                           # SectionCard, TableCard, MonthSwitcher, DataNotice…
│   ├── forms/                  # Kit de formulários: useFormAction, Field, SelectField,
│   │                           # FormDialog, ConfirmDialog, PreacherSelect, useAutoOpen
│   ├── dashboard/              # Blocos do dashboard
│   ├── calendar/               # MonthCalendar, ScheduleView, ServiceForm
│   ├── preachers/ availability/ contacts/ settings/   # Telas interativas de cada módulo
├── config/
│   ├── site.ts                 # Nome, fuso horário, caminho do logotipo
│   └── navigation.ts           # Itens da sidebar (fonte única da navegação)
├── lib/
│   ├── supabase/               # env, client (browser), server, proxy (sessão)
│   ├── data/                   # Consultas server-only por domínio
│   ├── actions/                # runAction, validateForm, guardRotation, tradução de erros do banco
│   ├── export/                 # CSV (pt-BR) e guarda de permissão das exportações
│   ├── validation/             # Schemas zod (fonte única das regras dos formulários)
│   └── domain/                 # Rótulos pt-BR, tons de status, datas, disponibilidade
├── types/database.ts           # Tipos do banco (espelham a migração)
└── proxy.ts                    # Renova sessão e protege rotas
supabase/migrations/            # SQL versionado (aplicar em ordem)
supabase/tests/db.test.mjs      # Testa migrações + RLS em Postgres em memória
```

## Arquitetura

### Fluxo de dados

```
Página (Server Component)
  └─ <Suspense fallback={skeleton}>
       └─ Componente async → lib/data/*.ts → query() → Supabase (cookies do usuário, RLS)
```

- **`lib/data/result.ts`** padroniza toda consulta em `DataResult<T>`:
  `unconfigured` (sem Supabase) · `error` (mensagem exibida) · `ok` (dados reais).
  O componente `DataNotice` mostra o aviso correspondente.
- Consultas são **server-only**; a chave publicável + RLS garantem que cada usuário só faça o que seu papel permite.
- Com **Cache Components**, tudo que depende de cookies, `searchParams` ou da data de hoje fica dentro de `<Suspense>` e chama `connection()` — o "casco" da página é pré-renderizado e os dados chegam por streaming.
- O mês exibido vem de `?mes=yyyy-MM` (links simples, funciona sem JavaScript e é compartilhável).
### Fluxo de mutações

```
Formulário (Client) ──useFormAction──▶ Server Action (rota/actions.ts)
                                          ├─ validateForm(schema zod)  → erros por campo
                                          └─ runAction()
                                               ├─ Supabase configurado?  is_staff()?
                                               ├─ escrita (RLS garante a permissão)
                                               ├─ dbError() → mensagem em português
                                               └─ refresh() → a página recarrega os dados
```

- Os formulários **não são resetados** em caso de erro; sucesso fecha o diálogo e mostra um toast.
- A interface esconde os botões de edição para usuários `leitor`, mas a regra real está no banco (RLS).
- `?novo=1` em qualquer tela de cadastro abre o formulário (usado pelas ações rápidas do dashboard).

### Calendário e escalas

**Cultos regulares:** sábado (manhã), quarta-feira (noite) e domingo (noite). As datas são geradas pelo banco
(`generate_regular_services(início, fim)`), com `generate_series` sobre o calendário gregoriano real — sem datas fixas no código.

| Item | Como funciona |
| --- | --- |
| Período inicial | dezembro/2026 a dezembro/2027 (169 cultos, criados pela migração `20261125000000`) |
| Idempotência | índice único `(data, tipo)` para cultos regulares + `on conflict do nothing`: gerar de novo nunca duplica |
| Expansão | **Configurações → Período do calendário**: ao ampliar, os cultos do novo período são criados automaticamente |
| Fuso horário | `America/Maceio` (cálculo de "hoje" e do mês corrente) |
| Dia errado | um trigger impede culto regular em dia da semana incompatível |
| Exclusão | cultos regulares não são excluídos (seriam recriados) — use **Cancelar culto**; extraordinários podem ser excluídos |
| Dezembro/2026 | todas as datas ficam **em aberto**, prontas para o administrador vincular os pregadores definidos pela igreja |

**Visualizações** (`/calendario`): calendário mensal (desktop) ou lista (`?visao=lista`; no celular a lista é usada sempre),
seletor de mês e ano limitado ao período configurado, navegação anterior/próximo, filtros por status e por pregador e
indicador de preenchimento (confirmados + realizados ÷ cultos não cancelados).

**Modal do culto:** vincular pregador (os que têm disponibilidade na data aparecem primeiro), alterar status, tema,
texto bíblico, horário e observações, **Remover vínculo**, **Cancelar/Reativar culto** e, para extraordinários,
data, período, nome e exclusão.

**Cores dos status:** cinza = em aberto · amarelo = aguardando confirmação · azul = confirmado · verde = realizado · vermelho = cancelado
(fonte única em `lib/domain/labels.ts` + `lib/domain/tone.ts`).

**PDF da escala:** `GET /calendario/pdf?mes=yyyy-MM` gera um PDF A4 (logotipo, mês, ano, datas, dias da semana, período e
pregadores). Os botões **Imprimir** (abre no navegador) e **PDF** (`&download=1`, baixa o arquivo) ficam no calendário.
O gerador de PDF não lê SVG: para o logotipo oficial no PDF, salve um PNG em `public/brand/` e defina `siteConfig.pdfLogoSrc`.

### Pregadores

**Cadastro** (`/pregadores`): nome completo e telefone com DDD obrigatórios; função, cargo, igreja de origem,
e-mail, WhatsApp alternativo, dias de preferência, observações e situação opcionais.

| Regra | Como funciona |
| --- | --- |
| Telefone | validado no app (`lib/domain/phone.ts`: DDD existente, celular com 9) e normalizado no banco (`normalize_br_phone`) para `phone_normalized` — remove máscara, `+55` e zero de operadora |
| Duplicados | ao preencher e ao salvar, compara telefone normalizado, nome sem acentos e primeiro + último nome (inclusive arquivados). O salvamento pede confirmação “É outra pessoa — salvar mesmo assim” |
| Situação | **Ativo** (pode ser escalado), **Inativo** (pausa temporária), **Arquivado** (sai das listas e da escala; histórico intacto; pode ser restaurado) |
| Exclusão | só para cadastros sem nenhum histórico. As chaves estrangeiras usam `on delete restrict` — o banco impede apagar quem tem cultos, convites, disponibilidades ou eventos |

**Lista:** busca por nome ou telefone (qualquer formato), filtros por situação e por última pregação (nunca pregou,
últimos 3 meses, sem pregar há 3/6 meses), ordenação alfabética ou por quem está há mais tempo sem pregar
(quem nunca pregou primeiro). Cada pregador mostra telefone, atalho de WhatsApp, última pregação (“há N dias”),
próxima pregação confirmada, total realizado e próxima disponibilidade.

**Estatísticas** (`preacher_overview`, calculadas no banco):
- Última pregação e total = cultos com status **realizado** até hoje. Convites recusados, cancelamentos e escalas futuras não contam.
- Um trigger impede marcar como realizado um culto com data futura.

**Perfil** (`/pregadores/[id]`): dados, observações, resumo, próximos cultos, disponibilidades futuras e
**histórico cronológico** com filtro (pregações, escala, convites, disponibilidades). O histórico combina:
cultos realizados, a tabela `preacher_events` (escalado, confirmado, cancelado, removido da escala —
registrada automaticamente por trigger, sem escrita pelo app), contatos com as respostas e disponibilidades informadas.

**WhatsApp:** o botão abre um diálogo com a mensagem padrão (Configurações → *Mensagem padrão do WhatsApp*,
variáveis `{nome}`, `{primeiro_nome}`, `{igreja}`) editável antes de abrir `wa.me`. Nada é enviado automaticamente.

### Contatos e disponibilidades

**Registro de contato** (`/contatos`): pregador, data, meio (WhatsApp, ligação, presencial, outro), convite para
**um mês** ou **uma data de culto** (ou sem data), resposta, observações e data sugerida para novo contato.

| Resposta | Efeito |
| --- | --- |
| Ainda não contatado | contato planejado (aparece em “Retomar”) |
| Aguardando resposta | se o convite foi para um culto: culto fica *aguardando confirmação* |
| Aceitou o convite | se foi para um culto: culto *confirmado* |
| Não está disponível / Necessita de novo contato | se o culto era deste pregador, a vaga reabre |
| Disponível em outro mês | abre campos de **meses** (vários), **datas específicas**, **dias da semana**, observações e novo contato — cria uma disponibilidade por mês, ligada ao contato |

**Histórico preservado:** contatos não têm UPDATE (RLS). Cada nova resposta é um **novo registro** (“Nova interação”),
ligado ao anterior por `previous_id`. A aba **Situação atual** mostra o último contato de cada pregador
(view `contact_latest`); **Histórico completo** mostra todos. Excluir existe só para lançamentos feitos por engano.

**Disponibilidades** (`/disponibilidades`): agrupadas por mês e ano, com telefone, dias disponíveis, última pregação,
último contato, observações, WhatsApp e **Vincular a culto** (lista só cultos compatíveis com as datas/dias informados
e exige escolher *aguardando confirmação* ou *confirmar escala*).

| Status | Quando |
| --- | --- |
| Disponibilidade informada | registrada |
| Aguardando nova confirmação | manual, ou pregador escalado num culto ainda não confirmado |
| Agendado | escala confirmada num culto coberto pela disponibilidade |
| Não está mais disponível | manual |
| Expirada | calculada: o período passou sem agendamento (`availability_overview.effective_status`) |

- **Disponibilidade nunca vira pregação confirmada sozinha** — só a escala muda o status.
- O trigger `services_sync_availability` atualiza a disponibilidade ao convidar/confirmar e a devolve a *informada*
  se o culto for reaberto, cancelado ou trocar de pregador. Mês, datas e dias originais nunca são alterados;
  cada mudança de status fica em `availability_events` e aparece no histórico do pregador.
- `start_date`/`end_date` são derivados pelo banco (mês inteiro ou da primeira à última data específica);
  `availability_covers()` (SQL) e `availabilityCovers()` (TS) aplicam período + datas + dias da semana.

**Calendário:** ao abrir um mês, o painel **Disponíveis em <mês>** lista quem sinalizou disponibilidade, com
WhatsApp e **Escalar**. No modal do culto, quem cobre a data aparece primeiro.

**Dashboard → Pendências de contato:** *Aguardando* (resposta pendente), *Retomar* (novo contato necessário,
ainda não contatado ou retorno atrasado) e *Hoje* (retornos de contatos e de disponibilidades programados para hoje),
além de **Disponíveis no próximo mês**.

### Regras da escala

| Ação | Efeito |
| --- | --- |
| Escolher pregador numa vaga `aberto` | o culto passa a `convidado` (carimba `invited_at`) |
| Status `confirmado` | carimba `confirmed_at`; exige pregador |
| Voltar para `aberto` | remove o pregador e os carimbos |
| **Gerar cultos regulares do mês** | aparece só num mês vazio; chama a mesma função idempotente do banco |
| Contato *aguardando resposta* para um culto | culto vira `convidado` com o pregador do contato |
| Contato *aceitou o convite* | culto vira `confirmado` |
| Contato *não disponível*, *outro mês* ou *novo contato* | se o convite era desse pregador, a vaga reabre |
| Culto com outro pregador já confirmado | o contato é recusado com aviso |
| Excluir pregador com cultos | bloqueado — use **Desativar** |

Ao agendar, pregadores com **disponibilidade registrada** para a data/tipo de culto aparecem primeiro, marcados como "disponível".

### Modelo de dados

| Tabela | Finalidade |
| --- | --- |
| `profiles` | Usuário do sistema (1:1 com `auth.users`), e-mail, papel (`administrador`, `secretario`, `leitor`) e **aprovação de acesso** |
| `church_settings` | Linha única: nome da igreja, distrito, fuso, cultos regulares, **período do calendário** (`schedule_start`/`schedule_end`), intervalo mínimo e regra de meses consecutivos, mensagem do WhatsApp |
| `audit_log` | Registro de alterações relevantes (trigger; leitura só do administrador) |
| `preachers` | Pregadores (categoria, contatos, igreja de origem, ativo/inativo) |
| `services` | Cada culto da escala: data, tipo (regular ou `especial`), **período** (manhã/tarde/noite), pregador e **status**: `aberto` → `convidado` (aguardando confirmação) → `confirmado` → `realizado` (ou `cancelado`) |
| `availabilities` | Períodos em que um pregador informou estar disponível (opcionalmente por tipo de culto) |
| `contact_logs` | Cada contato/convite: canal, resultado (`aguardando`, `aceito`, `recusado`, `sem_resposta`), data de retorno |
| `preaching_history` (view) | Cultos `realizado` com nome do pregador |
| `preacher_events` | Eventos da escala por pregador, gravados por trigger (somente leitura para o app) |
| `availability_events` | Mudanças de status de cada disponibilidade (trigger, somente leitura) |
| `availability_overview` (view) | Disponibilidade + status efetivo (expirada), pregador, última pregação e último contato |
| `contact_latest` (view) | Último contato de cada pregador (situação atual) |
| `preacher_overview` (view) | Pregador + última pregação, total, próxima confirmada e próxima disponibilidade |

Regras no banco: um culto por data+tipo, pregador obrigatório para `convidado/confirmado/realizado`, período de disponibilidade válido, `updated_at` automático, perfil criado automaticamente no cadastro.

**RLS:** leitura apenas para usuários **aprovados** (`is_member()`); inserção/edição/remoção para `administrador` e `secretario` aprovados (`is_staff()`); configurações, usuários e registro de alterações só pelo administrador; contatos sem UPDATE; eventos e auditoria somente por trigger; nenhum privilégio para o papel anônimo.

**Usuários:** novos usuários são criados em Supabase → Authentication (entram como `leitor`, **sem acesso**); o administrador libera o acesso e ajusta o papel em **Configurações → Usuários e permissões**.

### Indicadores do dashboard

| Indicador | Regra |
| --- | --- |
| Cultos no mês | `services` do mês selecionado, exceto `cancelado` |
| Pregadores confirmados | status `confirmado` ou `realizado` no mês |
| Vagas em aberto | status `aberto` no mês |
| Aguardando resposta | status `convidado` no mês |
| Disponibilidades futuras | `availabilities` com `end_date >= hoje` |
| Pregadores cadastrados | `preachers` ativos |
| Progresso da escala | confirmados ÷ cultos do mês |
| Próximas pregações | a partir de hoje, `confirmado`/`convidado` |
| Pendências | a partir de hoje, `aberto`/`convidado` |
| Disponíveis no próximo mês | disponibilidades que cruzam o mês seguinte ao atual |

"Hoje" é calculado no fuso `siteConfig.timezone` (`America/Maceio`).

## Design system

Tokens definidos em `src/app/globals.css`. **Use sempre as classes semânticas**, nunca hex direto.

| Token | Cor | Uso |
| --- | --- | --- |
| `primary` / `brand-600` | `#005579` | Ações principais, item ativo |
| `brand-700` | `#003B55` | Títulos de marca |
| `brand-500` / `ring` / `info` | `#007BAA` | Foco, destaques |
| `background` | `#F8FAFC` | Fundo da aplicação |
| `card` | `#FFFFFF` | Superfícies |
| `foreground` | `#0F172A` | Texto principal |
| `muted-foreground` | `#64748B` | Texto secundário |
| `border` | `#E2E8F0` | Bordas |
| `success` | `#16A34A` | Confirmado |
| `warning` | `#D97706` | Aguardando / atenção |
| `destructive` | `#DC2626` | Vaga em aberto / alerta |

- Status → tom em `lib/domain/labels.ts`; tom → classes em `lib/domain/tone.ts` (fonte única para badges e ícones).
- Cards: borda `border` + sombra `shadow-card` discreta, raio `xl`.
- Sidebar retrátil (`Ctrl/⌘ + B`), vira gaveta no mobile; estado lembrado em cookie.

### Logotipo

O logotipo oficial ainda não foi adicionado ao projeto; a interface usa um símbolo provisório neutro. Para usar o oficial:

1. Salve o arquivo em `public/brand/logo-iasd.svg` (ou `.png`).
2. Em `src/config/site.ts`, defina `logoSrc: "/brand/logo-iasd.svg"`.

## Scripts

| Comando | Ação |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm test` | Executa `test:unit` e `test:db` |
| `npm run test:unit` | Regras de telefone, WhatsApp, duplicados, cobertura de disponibilidade e validação do contato |
| `npm run test:db` | Aplica as 6 migrações num Postgres em memória e testa: datas geradas (comparadas a um cálculo independente), idempotência, expansão de período, regras dos cultos, telefones, histórico, contatos, disponibilidades, rotatividade, conflitos, aprovação de acesso, RLS e auditoria |
| `npx supabase gen types typescript --project-id <id> > src/types/database.ts` | Regenerar tipos após mudanças no banco |
