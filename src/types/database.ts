/**
 * Tipos do banco de dados (Supabase).
 *
 * Escritos à mão espelhando `supabase/migrations/*.sql`. Quando o projeto
 * Supabase estiver criado, regenere com:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = "administrador" | "secretario" | "leitor"
export type PreacherCategory = "pastor" | "anciao" | "diacono" | "membro" | "convidado" | "outro"
export type ServiceType = "sabado_manha" | "sabado_tarde" | "domingo_noite" | "quarta_noite" | "especial"
export type ServicePeriod = "manha" | "tarde" | "noite"
export type ServiceStatus = "aberto" | "convidado" | "confirmado" | "realizado" | "cancelado"
export type ContactChannel = "whatsapp" | "telefone" | "email" | "presencial" | "outro"
/** Status do contato (enum contact_status no banco). */
export type ContactOutcome = "nao_contatado" | "aguardando" | "aceito" | "indisponivel" | "outro_mes" | "novo_contato"
export type AvailabilityStatus = "informada" | "aguardando_confirmacao" | "agendado" | "indisponivel" | "expirada"

type Timestamps = { created_at: string; updated_at: string }

export type ProfileRow = Timestamps & {
  id: string
  full_name: string
  email: string | null
  role: UserRole
  /** Acesso liberado pelo administrador (sem isso, nenhum dado é visível). */
  approved: boolean
  approved_at: string | null
}

export type AuditLogRow = {
  id: number
  table_name: string
  record_id: string | null
  action: "insert" | "update" | "delete"
  changes: Json
  changed_by: string | null
  changed_at: string
}

export type ChurchSettingsRow = {
  id: number
  church_name: string
  district: string | null
  city: string | null
  timezone: string
  default_service_types: ServiceType[]
  invite_lead_days: number
  schedule_start: string
  schedule_end: string
  whatsapp_template: string
  min_interval_days: number
  consecutive_month_alert: boolean
  updated_at: string
}

export type PreacherRow = Timestamps & {
  id: string
  full_name: string
  category: PreacherCategory
  phone: string | null
  whatsapp: string | null
  email: string | null
  home_church: string | null
  notes: string | null
  is_active: boolean
  role_title: string | null
  /** Dias da semana preferidos (0 = domingo … 6 = sábado). */
  preferred_weekdays: number[]
  /** DDD + número (10/11 dígitos), calculado pelo banco. */
  phone_normalized: string | null
  archived_at: string | null
  created_by: string | null
}

/** preacher_overview: pregador + estatísticas calculadas no banco. */
export type PreacherOverviewRow = PreacherRow & {
  last_preached_on: string | null
  total_preached: number
  next_confirmed_on: string | null
  next_confirmed_period: ServicePeriod | null
  next_available_start: string | null
  next_available_end: string | null
}

export type PreacherEventType = "escalado" | "confirmado" | "realizado" | "cancelado" | "desvinculado" | "reaberto"

export type PreacherEventRow = {
  id: string
  preacher_id: string
  service_id: string | null
  service_date: string
  service_type: ServiceType
  period: ServicePeriod
  event_type: PreacherEventType
  occurred_at: string
  created_by: string | null
}

export type ServiceRow = Timestamps & {
  id: string
  service_date: string
  start_time: string | null
  service_type: ServiceType
  period: ServicePeriod
  title: string | null
  status: ServiceStatus
  preacher_id: string | null
  sermon_title: string | null
  bible_reference: string | null
  notes: string | null
  invited_at: string | null
  confirmed_at: string | null
  created_by: string | null
}

export type AvailabilityRow = Timestamps & {
  id: string
  preacher_id: string
  /** 1º dia do mês da disponibilidade. */
  availability_month: string
  /** Datas específicas (vazio = qualquer data do mês). */
  specific_dates: string[]
  /** Dias da semana (0 = domingo; vazio = qualquer dia). */
  weekdays: number[]
  /** Derivados pelo banco a partir do mês e das datas específicas. */
  start_date: string
  end_date: string
  service_types: ServiceType[]
  status: AvailabilityStatus
  follow_up_on: string | null
  source_contact_id: string | null
  service_id: string | null
  notes: string | null
  created_by: string | null
}

export type AvailabilityOverviewRow = AvailabilityRow & {
  effective_status: AvailabilityStatus
  preacher_name: string
  preacher_phone: string | null
  preacher_whatsapp: string | null
  preacher_active: boolean
  preacher_archived_at: string | null
  last_preached_on: string | null
  last_contacted_at: string | null
}

export type AvailabilityEventRow = {
  id: string
  availability_id: string
  preacher_id: string
  from_status: AvailabilityStatus | null
  to_status: AvailabilityStatus
  service_id: string | null
  occurred_at: string
  created_by: string | null
}

export type ContactLogRow = Timestamps & {
  id: string
  preacher_id: string
  service_id: string | null
  channel: ContactChannel
  outcome: ContactOutcome
  contacted_at: string
  /** 1º dia do mês para o qual foi convidado. */
  invited_for_month: string | null
  /** Contato anterior da mesma conversa (histórico encadeado). */
  previous_id: string | null
  follow_up_on: string | null
  notes: string | null
  created_by: string | null
}

export type ContactLatestRow = ContactLogRow & {
  preacher_name: string
  preacher_phone: string | null
  preacher_whatsapp: string | null
}

export type PreachingHistoryRow = {
  id: string
  service_date: string
  service_type: ServiceType
  title: string | null
  sermon_title: string | null
  bible_reference: string | null
  preacher_id: string
  preacher_name: string
  preacher_category: PreacherCategory
}

type Generated = "id" | "created_at" | "updated_at" | "created_by"

type Table<Row, Required extends keyof Row, Rel extends unknown[] = []> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>
  Update: Partial<Omit<Row, Generated>>
  Relationships: Rel
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id">
      church_settings: Table<ChurchSettingsRow, never>
      preachers: Table<PreacherRow, "full_name">
      services: Table<
        ServiceRow,
        "service_date",
        [
          {
            foreignKeyName: "services_preacher_id_fkey"
            columns: ["preacher_id"]
            isOneToOne: false
            referencedRelation: "preachers"
            referencedColumns: ["id"]
          },
        ]
      >
      availabilities: Table<
        AvailabilityRow,
        "preacher_id" | "availability_month",
        [
          {
            foreignKeyName: "availabilities_preacher_id_fkey"
            columns: ["preacher_id"]
            isOneToOne: false
            referencedRelation: "preachers"
            referencedColumns: ["id"]
          },
        ]
      >
      preacher_events: Table<
        PreacherEventRow,
        "preacher_id" | "service_date" | "service_type" | "period" | "event_type",
        [
          {
            foreignKeyName: "preacher_events_preacher_id_fkey"
            columns: ["preacher_id"]
            isOneToOne: false
            referencedRelation: "preachers"
            referencedColumns: ["id"]
          },
        ]
      >
      audit_log: Table<AuditLogRow, "table_name" | "action" | "changes">
      availability_events: Table<AvailabilityEventRow, "availability_id" | "preacher_id" | "to_status">
      contact_logs: Table<
        ContactLogRow,
        "preacher_id",
        [
          {
            foreignKeyName: "contact_logs_preacher_id_fkey"
            columns: ["preacher_id"]
            isOneToOne: false
            referencedRelation: "preachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_logs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      >
    }
    Views: {
      preaching_history: { Row: PreachingHistoryRow; Relationships: [] }
      preacher_overview: { Row: PreacherOverviewRow; Relationships: [] }
      availability_overview: { Row: AvailabilityOverviewRow; Relationships: [] }
      contact_latest: { Row: ContactLatestRow; Relationships: [] }
    }
    Functions: {
      is_staff: { Args: Record<string, never>; Returns: boolean }
      generate_regular_services: { Args: { p_start: string; p_end: string }; Returns: number }
      church_today: { Args: Record<string, never>; Returns: string }
      normalize_br_phone: { Args: { raw: string }; Returns: string | null }
      is_member: { Args: Record<string, never>; Returns: boolean }
      current_user_role: { Args: Record<string, never>; Returns: UserRole | null }
      rotation_snapshot: {
        Args: { p_date: string; p_period: ServicePeriod; p_exclude_service?: string | null }
        Returns: {
          preacher_id: string
          last_realized_before: string | null
          last_before: string | null
          next_after: string | null
          month_count: number
          prev_month_count: number
          conflict: boolean
          same_day_other: boolean
        }[]
      }
    }
    Enums: {
      user_role: UserRole
      preacher_category: PreacherCategory
      service_type: ServiceType
      service_period: ServicePeriod
      service_status: ServiceStatus
      contact_channel: ContactChannel
      contact_status: ContactOutcome
      availability_status: AvailabilityStatus
    }
    CompositeTypes: Record<string, never>
  }
}
