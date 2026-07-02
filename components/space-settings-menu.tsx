"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

export function SpaceSettingsMenu({
  vaultId,
  action
}: {
  vaultId: string;
  action: "delete" | "leave";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  const isDelete = action === "delete";
  const label = isDelete ? "Delete space" : "Leave space";
  const confirmMessage = isDelete
    ? "Delete this space and all of its plants, reminders, and invites?"
    : "Leave this space?";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleAction() {
    setOpen(false);
    if (!window.confirm(confirmMessage)) return;

    startTransition(async () => {
      const response = await fetch(`/api/vault/${vaultId}`, { method: "DELETE" });
      const payload = await response
        .json()
        .catch(() => ({ error: `Unable to ${action} space` }));

      if (!response.ok) {
        window.alert(payload.error ?? `Unable to ${action} space`);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="space-settings-menu" ref={menuRef}>
      <button
        aria-label="Space options"
        className="space-settings-menu__trigger"
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <Icon name="dotsThreeVertical" />
      </button>
      {open && (
        <div className="space-settings-menu__dropdown">
          <button
            className="space-settings-menu__item space-settings-menu__item--danger"
            onClick={handleAction}
            type="button"
          >
            {label}
          </button>
        </div>
      )}
    </div>
  );
}
