"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { buttonClassName } from "@/components/ui/button";
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
    <div className="invite-link-panel">
      <div className="invite-link-row">
        <div className="invite-link-box">
          <span className="invite-link-box__label">Invite link</span>
          <input
            aria-label="Invite link"
            className="invite-link-box__input"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={url ?? "Generating link…"}
          />
        </div>
        <button
          aria-label={copied ? "Copied" : "Copy invite link"}
          className={buttonClassName({
            variant: "primary",
            className: `invite-copy-btn${copied ? " invite-copy-btn--copied" : ""}`
          })}
          disabled={!url}
          onClick={() => void copy()}
          type="button"
        >
          <Icon className="ui-button__icon" name={copied ? "check" : "clipboard"} />
          <span className="ui-button__label">{copied ? "Copied!" : "Copy invite link"}</span>
        </button>
      </div>
      <button
        aria-label="Generate new link"
        className="invite-regenerate"
        disabled={isGenerating}
        onClick={() => void generate()}
        title="Generate new link"
        type="button"
      >
        <Icon
          className={isGenerating ? "invite-link-field__spin" : undefined}
          name="arrowClockwise"
        />
        <span>Regenerate</span>
      </button>
    </div>
  );
}
