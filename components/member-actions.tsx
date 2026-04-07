"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";

export function MemberActions({
  vaultId,
  memberId,
  initialRole
}: {
  vaultId: string;
  memberId: string;
  initialRole: "editor" | "member";
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [role, setRole] = useState<"editor" | "member">(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const roleLabel = role;

  function updateRole() {
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/vault/${vaultId}/members/${memberId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role })
      });

      const payload = await response
        .json()
        .catch(() => ({ error: "Unable to update member role" }));

      if (!response.ok) {
        setError(payload.error ?? "Unable to update member role");
        return;
      }

      setIsEditing(false);
      router.refresh();
    });
  }

  function removeMember() {
    if (!window.confirm("Remove this member from the space?")) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/vault/${vaultId}/members/${memberId}`, {
        method: "DELETE"
      });

      const payload = await response.json().catch(() => ({ error: "Unable to remove member" }));

      if (!response.ok) {
        setError(payload.error ?? "Unable to remove member");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="member-actions">
      {isEditing ? (
        <>
          <select
            onChange={(event) => setRole(event.target.value as "editor" | "member")}
            value={role}
          >
            <option value="member">Member</option>
            <option value="editor">Editor</option>
          </select>
          <button
            className={buttonClassName({
              variant: "secondary"
            })}
            disabled={isPending}
            onClick={updateRole}
            type="button"
          >
            OK
          </button>
          <button
            className={buttonClassName({
              variant: "danger"
            })}
            disabled={isPending}
            onClick={removeMember}
            type="button"
          >
            X
          </button>
        </>
      ) : (
        <>
          <span className="member-role">{roleLabel}</span>
          <button
            className={buttonClassName({
              variant: "ghost"
            })}
            disabled={isPending}
            onClick={() => {
              setError(null);
              setIsEditing(true);
            }}
            type="button"
          >
            Edit
          </button>
        </>
      )}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
