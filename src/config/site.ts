export const siteConfig = {
  name: "IASD Estação",
  product: "Gestão de Pregadores",
  churchName: "Igreja Adventista do Sétimo Dia da Estação",
  description: "Organização das escalas de pregação da IASD Estação.",
  /** Fuso usado para calcular "hoje" e o mês corrente. */
  timezone: "America/Maceio",
  /**
   * Caminho do logotipo oficial em /public. Enquanto for `null`, a interface
   * exibe o símbolo provisório. Ex.: "/brand/logo-iasd.svg"
   */
  logoSrc: null as string | null,
  /** Logotipo em PNG/JPG para o PDF da escala (ex.: "/brand/logo-iasd.png"). */
  pdfLogoSrc: null as string | null,
  /**
   * Faixa padrão do calendário (yyyy-MM). O valor efetivo vem de
   * church_settings.schedule_start/end e pode ser ampliado em Configurações.
   */
  defaultSchedule: { start: "2026-12", end: "2027-12" },
} as const
