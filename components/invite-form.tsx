"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";

export function InviteForm({ vaultId }: { vaultId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/vault/${vaultId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const payload = await response.json().catch(() => ({ error: "Unable to create invite" }));

      if (!response.ok) {
        setError(payload.error ?? "Unable to create invite");
        return;
      }

      setEmail("");
      setShowSuccess(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShowSuccess(false), 2000);
      router.refresh();
    });
  }

  return (
    <form className="stack-sm" onSubmit={onSubmit}>
      <label className="field">
        <span>Email address</span>
        <div className="invite-form-input-wrap">
          {showSuccess ? <div className="invite-sent-feedback">Invite sent!</div> : null}
          <input
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@example.com"
            type="email"
            value={email}
          />
        </div>
      </label>
      {error ? <p className="field-error">{error}</p> : null}
      <button
        className={buttonClassName({ variant: "primary" })}
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Sending..." : "Create invite"}
      </button>
    </form>
  );
}
