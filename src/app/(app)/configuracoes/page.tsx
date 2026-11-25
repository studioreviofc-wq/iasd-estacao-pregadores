import { CheckCircle2, Church, Database, UserCog, Users } from "lucide-react"
import type { Metadata } from "next"
import { Suspense } from "react"

import { ChurchSettingsForm } from "@/components/settings/church-settings-form"
import { AuditLogList } from "@/components/settings/audit-log-list"
import { DataExports } from "@/components/settings/data-exports"
import { UsersList } from "@/components/settings/users-list"
import { DataNotice } from "@/components/shared/data-notice"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getSettings, listAuditLog } from "@/lib/data/settings"
import { userRoleLabel } from "@/lib/domain/labels"

export const metadata: Metadata = { title: "Configurações" }

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium sm:text-right">{value ?? "—"}</dd>
    </div>
  )
}

const setupSteps = [
  "Crie um projeto em supabase.com.",
  "No SQL Editor, execute o arquivo supabase/migrations/20261124000000_initial_schema.sql.",
  "Copie .env.example para .env.local e preencha a URL e a chave publicável do projeto.",
  "Em Authentication, crie o primeiro usuário e defina o papel “administrador” na tabela profiles.",
  "Reinicie o servidor (npm run dev) e entre com esse usuário.",
]

async function SettingsContent() {
  const result = await getSettings()
  const { settings, profile, email, users } = result.data
  const isAdmin = profile?.role === "administrador" && profile.approved
  const audit = isAdmin ? await listAuditLog() : null
  const connected = result.status === "ok"

  return (
    <>
      <DataNotice result={result} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Banco de dados"
          description="Conexão com o Supabase"
          action={<Database className="size-4 text-muted-foreground" />}
        >
          <dl className="divide-y divide-border">
            <Field
              label="Situação"
              value={
                <StatusBadge
                  tone={connected ? "success" : result.status === "error" ? "danger" : "warning"}
                  label={connected ? "Conectado" : result.status === "error" ? "Erro de conexão" : "Não configurado"}
                />
              }
            />
            <Field label="Autenticação" value="Supabase Auth (e-mail e senha)" />
            <Field label="Segurança" value="Row Level Security ativo" />
          </dl>
        </SectionCard>

        <SectionCard title="Minha conta" action={<UserCog className="size-4 text-muted-foreground" />}>
          <dl className="divide-y divide-border">
            <Field label="E-mail" value={email} />
            <Field label="Nome" value={profile?.full_name || null} />
            <Field label="Permissão" value={profile ? userRoleLabel[profile.role] : null} />
          </dl>
        </SectionCard>

        <SectionCard
          title="Igreja"
          description="Dados usados na escala"
          action={<Church className="size-4 text-muted-foreground" />}
          className="lg:row-span-2"
        >
          <ChurchSettingsForm settings={settings} canEdit={isAdmin} />
        </SectionCard>

        <SectionCard title="Primeiros passos" description="Configuração inicial do sistema">
          <ol className="space-y-3">
            {setupSteps.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm">
                {connected && i < 3 ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                ) : (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600">
                    {i + 1}
                  </span>
                )}
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>

      {isAdmin ? (
        <SectionCard
          title="Usuários e permissões"
          description="Novos usuários são convidados em Supabase → Authentication e aparecem aqui."
          action={<Users className="size-4 text-muted-foreground" />}
        >
          <UsersList users={users} currentUserId={profile?.id} />
        </SectionCard>
      ) : null}

      {connected ? (
        <SectionCard title="Backup e exportação" description="Arquivos gerados na hora, a partir do banco de dados.">
          <DataExports role={profile?.approved ? profile.role : null} />
        </SectionCard>
      ) : null}

      {isAdmin && audit ? (
        <SectionCard title="Registro de alterações" description="Últimas 60 alterações em pregadores, escala, contatos, disponibilidades, configurações e usuários.">
          <AuditLogList rows={audit.data} users={users} />
        </SectionCard>
      ) : null}
    </>
  )
}

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader title="Configurações" description="Conexão, conta e preferências da igreja." />
      <Suspense
        fallback={
          <div className="grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        }
      >
        <SettingsContent />
      </Suspense>
    </PageContainer>
  )
}
