"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClassName } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InviteListItem, type InviteForSettings } from "@/components/invite-list-item";

const PAGE_SIZE = 10;

export function InvitesDialog({
  vaultId,
  invites
}: {
  vaultId: string;
  invites: InviteForSettings[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(invites.length / PAGE_SIZE));
  // Clamp the page if the list shrank (e.g. an invite was revoked while open).
  const safePage = Math.min(page, pageCount - 1);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const start = safePage * PAGE_SIZE;
  const pageItems = invites.slice(start, start + PAGE_SIZE);

  function open() {
    setPage(0);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button className="settings-view-all-link" onClick={open} type="button">
        View all invite links →
      </button>
      <dialog
        className="invites-dialog"
        onClick={(event) => {
          // Clicks on the backdrop land on the <dialog> element itself (its content
          // fills it edge-to-edge with padding: 0), so close when that happens.
          if (event.target === event.currentTarget) {
            close();
          }
        }}
        ref={dialogRef}
      >
        <div className="invites-dialog__header">
          <h3>Invite links</h3>
          <button
            aria-label="Close"
            className="invites-dialog__close"
            onClick={close}
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="invites-dialog__list settings-rows settings-rows--flat">
          {pageItems.map((invite) => (
            <InviteListItem invite={invite} key={invite.id} vaultId={vaultId} />
          ))}
        </div>
        {pageCount > 1 ? (
          <div className="invites-dialog__pagination">
            <button
              className={buttonClassName({ variant: "subtle", size: "sm" })}
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              type="button"
            >
              Previous
            </button>
            <span>
              Page {safePage + 1} of {pageCount}
            </span>
            <button
              className={buttonClassName({ variant: "subtle", size: "sm" })}
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
