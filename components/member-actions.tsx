"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
  const [role, setRole] = useState<"editor" | "member">(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      <select
        onChange={(event) => setRole(event.target.value as "editor" | "member")}
        value={role}
      >
        <option value="member">Water only</option>
        <option value="editor">Can edit plants</option>
      </select>
      <button
        className="button button-secondary"
        disabled={isPending}
        onClick={updateRole}
        type="button"
      >
        Save
      </button>
      <button
        className="button button-ghost"
        disabled={isPending}
        onClick={removeMember}
        type="button"
      >
        Remove
      </button>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
