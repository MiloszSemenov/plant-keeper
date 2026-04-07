"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";

export function CreateVaultForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/vaults", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name })
      });

      const payload = await response.json().catch(() => ({ error: "Unable to create space" }));

      if (!response.ok) {
        setError(payload.error ?? "Unable to create space");
        return;
      }

      setName("");
      router.push(`/dashboard?vaultId=${payload.vault.id}`);
      router.refresh();
    });
  }

  return (
    <form className="stack-sm" onSubmit={onSubmit}>
      <label className="field">
        <span>New space name</span>
        <input
          onChange={(event) => setName(event.target.value)}
          placeholder="Home jungle"
          required
          value={name}
        />
      </label>
      {error ? <p className="field-error">{error}</p> : null}
      <button
        className={buttonClassName({
          variant: "secondary"
        })}
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Creating..." : "Create space"}
      </button>
    </form>
  );
}
