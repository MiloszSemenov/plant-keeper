"use client";

import { useRef, useEffect, useState } from "react";
import { buttonClassName, type ButtonVariant } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InviteForm } from "@/components/invite-form";

export function InviteMemberAction({
  vaultId,
  variant = "primary"
}: {
  vaultId: string;
  variant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div className="invite-member-action" ref={wrapRef}>
      <button
        className={buttonClassName({ variant })}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <Icon className="ui-button__icon" name="add" />
        <span className="ui-button__label">Invite member</span>
      </button>
      {open ? (
        <div className="invite-member-panel">
          <InviteForm vaultId={vaultId} />
        </div>
      ) : null}
    </div>
  );
}
