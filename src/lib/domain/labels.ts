import type {
  AvailabilityStatus,
  ContactChannel,
  ContactOutcome,
  PreacherCategory,
  ServicePeriod,
  ServiceStatus,
  ServiceType,
  UserRole,
} from "@/types/database"

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger"

/**
 * Identidade visual dos status da escala:
 * cinza = em aberto · amarelo = aguardando · azul = confirmado ·
 * verde = realizado · vermelho = cancelado
 */
export const serviceStatusMeta: Record<ServiceStatus, { label: string; short: string; tone: Tone }> = {
  aberto: { label: "Em aberto", short: "Em aberto", tone: "neutral" },
  convidado: { label: "Aguardando confirmação", short: "Aguardando", tone: "warning" },
  confirmado: { label: "Confirmado", short: "Confirmado", tone: "brand" },
  realizado: { label: "Realizado", short: "Realizado", tone: "success" },
  cancelado: { label: "Cancelado", short: "Cancelado", tone: "danger" },
}

export const serviceTypeLabel: Record<ServiceType, string> = {
  sabado_manha: "Culto de sábado",
  sabado_tarde: "Sábado à tarde",
  domingo_noite: "Culto de domingo",
  quarta_noite: "Culto de quarta-feira",
  especial: "Culto extraordinário",
}

export const servicePeriodLabel: Record<ServicePeriod, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
}

/** Nome do culto para exibição: título do extraordinário ou tipo regular. */
export function serviceName(s: { service_type: ServiceType; title: string | null }) {
  return s.title || serviceTypeLabel[s.service_type]
}

export const preacherCategoryLabel: Record<PreacherCategory, string> = {
  pastor: "Pastor",
  anciao: "Ancião",
  diacono: "Diácono",
  membro: "Membro",
  convidado: "Convidado",
  outro: "Outro",
}

export const contactChannelLabel: Record<ContactChannel, string> = {
  whatsapp: "WhatsApp",
  telefone: "Ligação",
  email: "E-mail",
  presencial: "Presencial",
  outro: "Outro",
}

/** Status do contato com o pregador. */
export const contactOutcomeMeta: Record<ContactOutcome, { label: string; tone: Tone }> = {
  nao_contatado: { label: "Ainda não contatado", tone: "neutral" },
  aguardando: { label: "Aguardando resposta", tone: "warning" },
  aceito: { label: "Aceitou o convite", tone: "success" },
  indisponivel: { label: "Não está disponível", tone: "danger" },
  outro_mes: { label: "Disponível em outro mês", tone: "brand" },
  novo_contato: { label: "Necessita de novo contato", tone: "warning" },
}

/** Status da disponibilidade futura. */
export const availabilityStatusMeta: Record<AvailabilityStatus, { label: string; tone: Tone }> = {
  informada: { label: "Disponibilidade informada", tone: "brand" },
  aguardando_confirmacao: { label: "Aguardando nova confirmação", tone: "warning" },
  agendado: { label: "Agendado", tone: "success" },
  indisponivel: { label: "Não está mais disponível", tone: "danger" },
  expirada: { label: "Expirada", tone: "neutral" },
}

export const userRoleLabel: Record<UserRole, string> = {
  administrador: "Administrador",
  secretario: "Secretário(a)",
  leitor: "Leitura",
}
