"use client"

import { startTransition, useActionState, type FormEvent } from "react"
import { toast } from "sonner"

import { idleState, type ActionState } from "@/lib/actions/state"

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>

/**
 * Conecta um formulário a uma Server Action:
 * - envia sem resetar o formulário (os valores ficam em caso de erro)
 * - exibe toast de sucesso/erro e chama `onSuccess` (ex.: fechar o diálogo)
 */
export function useFormAction(action: Action, options: { onSuccess?: () => void } = {}) {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await action(prev, formData)
    if (result.status === "success") {
      toast.success(result.message)
      options.onSuccess?.()
    } else if (result.status === "error" && !result.fieldErrors) {
      toast.error(result.message)
    }
    return result
  }, idleState)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => dispatch(formData))
  }

  const fieldError = (name: string) => (state.status === "error" ? state.fieldErrors?.[name] : undefined)

  return { state, pending, onSubmit, fieldError }
}
