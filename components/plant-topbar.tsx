"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function PlantTopbar({
  vaultId,
  plantId,
  canDelete
}: {
  vaultId: string;
  plantId: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  function openDeleteDialog() {
    setMenuOpen(false);
    setError(null);
    dialogRef.current?.showModal();
  }

  function closeDeleteDialog() {
    dialogRef.current?.close();
  }

  function confirmDelete() {
    setError(null);
    startDeleting(async () => {
      const response = await fetch(`/api/plants/${plantId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({ error: "Unable to delete plant" }));
      if (!response.ok) {
        setError(payload.error ?? "Unable to delete plant");
        return;
      }
      router.push(`/dashboard?vaultId=${vaultId}`);
      router.refresh();
    });
  }

  return (
    <>
      <header className="topbar plant-topbar">
        <div className="topbar-copy">
          <Link className="back-link" href={`/dashboard?vaultId=${vaultId}`}>
            <Icon name="back" />
            Edit plant
          </Link>
        </div>

        {canDelete ? (
          <div className="plant-topbar-menu" ref={menuRef}>
            <button
              aria-label="More actions"
              className={buttonClassName({ variant: "ghost", size: "icon" })}
              onClick={() => setMenuOpen((v) => !v)}
              type="button"
            >
              <Icon name="dotsThreeVertical" />
            </button>

            {menuOpen ? (
              <div className="plant-topbar-dropdown" role="menu">
                <button
                  className="plant-topbar-dropdown__item plant-topbar-dropdown__item--danger"
                  onClick={openDeleteDialog}
                  role="menuitem"
                  type="button"
                >
                  <Icon name="trash" />
                  Delete plant
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <dialog className="confirm-dialog" ref={dialogRef}>
        <div className="confirm-dialog__body">
          <p className="confirm-dialog__text">Are you sure you want to delete this plant?</p>
          {error ? <p className="field-error">{error}</p> : null}
          <div className="confirm-dialog__actions">
            <button
              className={buttonClassName({ variant: "subtle" })}
              disabled={isDeleting}
              onClick={closeDeleteDialog}
              type="button"
            >
              Cancel
            </button>
            <button
              className={buttonClassName({ variant: "danger" })}
              disabled={isDeleting}
              onClick={confirmDelete}
              type="button"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
