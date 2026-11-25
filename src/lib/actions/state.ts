/** Estado retornado por toda Server Action de formulário. */
export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error"
      message: string
      fieldErrors?: Record<string, string>
      /** Possíveis cadastros duplicados (exigem confirmação do usuário). */
      duplicates?: { id: string; full_name: string; phone: string | null; archived: boolean; reason: string }[]
      /** Alertas de rotatividade: o usuário pode confirmar e reenviar. */
      rotation?: { preacher: string; warnings: string[] }
    }

export const idleState: ActionState = { status: "idle" }
