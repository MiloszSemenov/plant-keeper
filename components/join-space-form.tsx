"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function JoinSpaceForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      return;
    }

    router.push(`/join?code=${encodeURIComponent(normalizedCode)}`);
    router.refresh();
  }

  return (
    <form className="stack-sm" onSubmit={onSubmit}>
      <label className="field">
        <span>Invite code</span>
        <input
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="PLANT-7F2K9"
          value={code}
        />
      </label>
      <button className="button button-primary" type="submit">
        Continue
      </button>
    </form>
  );
}
