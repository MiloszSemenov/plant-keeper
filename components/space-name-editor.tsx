"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";

export function SpaceNameEditor({
  vaultId,
  initialName,
  canEdit
}: {
  vaultId: string;
  initialName: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync local value when the server-rendered name changes (after a refresh).
  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  function cancel() {
    setName(initialName);
    setIsEditing(false);
  }

  function save() {
    const trimmed = name.trim();

    if (trimmed.length < 2) {
      toast.error("Space name must be at least 2 characters");
      return;
    }

    if (trimmed === initialName) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/vault/${vaultId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Unable to rename space");
        }
        setIsEditing(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to rename space");
      }
    });
  }

  if (!canEdit) {
    return <h1 className="settings-space-name">{initialName}</h1>;
  }

  if (!isEditing) {
    return (
      <div className="space-name-display">
        <h1 className="settings-space-name">{name}</h1>
        <button
          aria-label="Edit space name"
          className="space-name-edit-btn"
          onClick={() => setIsEditing(true)}
          type="button"
        >
          <Icon name="edit" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-name-edit">
      <input
        className="space-name-input"
        disabled={isPending}
        maxLength={80}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        ref={inputRef}
        value={name}
      />
      <button
        aria-label="Save space name"
        className="space-name-action space-name-action--save"
        disabled={isPending}
        onClick={save}
        type="button"
      >
        <Icon name="save" />
      </button>
      <button
        aria-label="Cancel"
        className="space-name-action"
        disabled={isPending}
        onClick={cancel}
        type="button"
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
