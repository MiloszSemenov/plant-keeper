"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";

export function GenerateLinkAction({ vaultId }: { vaultId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void generate();
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/vault/${vaultId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.inviteUrl) {
        toast.error("Failed to generate invite link. Please try again.");
        return;
      }
      setUrl(payload.inviteUrl as string);
    } finally {
      setIsGenerating(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      toast.error("Failed to copy link to clipboard.");
      return;
    }
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    setCopied(true);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="invite-link-field">
      <div className="invite-link-field__text">
        <span className="invite-link-field__label">Invite link</span>
        <input
          aria-label="Invite link"
          className="invite-link-field__input"
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          value={url ?? "Generating link…"}
        />
      </div>
      <div className="invite-link-field__actions">
        <button
          aria-label={copied ? "Copied" : "Copy invite link"}
          className={`invite-link-field__action${copied ? " invite-link-field__action--copied" : ""}`}
          disabled={!url}
          onClick={() => void copy()}
          title={copied ? "Copied!" : "Copy link"}
          type="button"
        >
          <Icon name={copied ? "check" : "clipboard"} />
        </button>
        <button
          aria-label="Generate new link"
          className="invite-link-field__action"
          disabled={isGenerating}
          onClick={() => void generate()}
          title="Generate new link"
          type="button"
        >
          <Icon
            className={isGenerating ? "invite-link-field__spin" : undefined}
            name="arrowClockwise"
          />
        </button>
      </div>
    </div>
  );
}
