"use client"

import { toast } from "sonner"

import { setUserApproved, updateUserRole } from "@/app/(app)/configuracoes/actions"
import { SelectField } from "@/components/forms/form-kit"
import { StatusBadge } from "@/components/shared/status-badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ActionState } from "@/lib/actions/state"
import { userRoleLabel } from "@/lib/domain/labels"
import { userRoles } from "@/lib/validation/settings"
import type { ProfileRow, UserRole } from "@/types/database"

const roleOptions = userRoles.map((r) => ({ value: r, label: userRoleLabel[r] }))

export function UsersList({ users, currentUserId }: { users: ProfileRow[]; currentUserId?: string }) {
  async function run(action: Promise<ActionState>) {
    const result = await action
    if (result.status === "success") toast.success(result.message)
    else if (result.status === "error") toast.error(result.message)
  }

  const pending = users.filter((u) => !u.approved).length

  return (
    <div className="space-y-3">
      {pending ? (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
          {pending} {pending === 1 ? "usuário aguarda" : "usuários aguardam"} liberação de acesso.
        </p>
      ) : null}
      <ul className="divide-y divide-border">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-medium">
                {u.full_name || "Sem nome"}
                {u.id === currentUserId ? <span className="text-xs font-normal text-muted-foreground">(você)</span> : null}
                {!u.approved ? <StatusBadge tone="warning" label="Aguardando liberação" /> : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">{u.email ?? "—"}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id={`approved-${u.id}`}
                  checked={u.approved}
                  disabled={u.id === currentUserId}
                  onCheckedChange={(v) => run(setUserApproved(u.id, v))}
                />
                <Label htmlFor={`approved-${u.id}`} className="text-sm font-normal">
                  Acesso
                </Label>
              </div>
              <div className="w-40">
                <SelectField
                  name={`role-${u.id}`}
                  options={roleOptions}
                  defaultValue={u.role}
                  onValueChange={(v) => run(updateUserRole(u.id, v as UserRole))}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
