"use client";

import { FormEvent, useState, useTransition } from "react";

export function InviteForm({ vaultId }: { vaultId: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInviteUrl(null);
    setInviteCode(null);
    setJoinUrl(null);

    startTransition(async () => {
      const response = await fetch(`/api/vault/${vaultId}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const payload = await response.json().catch(() => ({ error: "Unable to create invite" }));

      if (!response.ok) {
        setError(payload.error ?? "Unable to create invite");
        return;
      }

      setInviteUrl(payload.inviteUrl);
      setInviteCode(payload.code ?? null);
      setJoinUrl(payload.joinUrl ?? null);
      setEmail("");
    });
  }

  return (
    <form className="stack-sm" onSubmit={onSubmit}>
      <label className="field">
        <span>Email address</span>
        <input
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@example.com"
          type="email"
          value={email}
        />
      </label>
      {error ? <p className="field-error">{error}</p> : null}
      <button className="button button-primary" disabled={isPending} type="submit">
        {isPending ? "Sending..." : "Create invite"}
      </button>
      {inviteUrl ? (
        <div className="callout">
          <p className="callout-title">Invite ready</p>
          <p>{email ? "Email invite created." : "Share the code or join link below."}</p>
          {inviteCode ? <code>{inviteCode}</code> : null}
          {joinUrl ? <code>{joinUrl}</code> : null}
          <code>{inviteUrl}</code>
        </div>
      ) : null}
    </form>
  );
}
