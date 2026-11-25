import type { Tone } from "./labels"

/** Classes de cor por tom semântico — fonte única para badges, ícones e indicadores. */
export const toneClasses: Record<Tone, { soft: string; icon: string; dot: string; bar: string }> = {
  neutral: { soft: "bg-slate-100 text-slate-600", icon: "bg-muted text-muted-foreground", dot: "bg-slate-400", bar: "border-l-slate-400" },
  brand: { soft: "bg-brand-50 text-brand-600", icon: "bg-brand-50 text-brand-600", dot: "bg-brand-600", bar: "border-l-brand-600" },
  success: { soft: "bg-success/10 text-success", icon: "bg-success/10 text-success", dot: "bg-success", bar: "border-l-success" },
  warning: { soft: "bg-warning/10 text-warning", icon: "bg-warning/10 text-warning", dot: "bg-warning", bar: "border-l-warning" },
  danger: { soft: "bg-destructive/10 text-destructive", icon: "bg-destructive/10 text-destructive", dot: "bg-destructive", bar: "border-l-destructive" },
}
