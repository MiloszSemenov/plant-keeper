"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";

type ManageableRole = "editor" | "member";

const ROLE_OPTIONS: ManageableRole[] = ["member", "editor"];

export function MemberActions({
  vaultId,
  memberId,
  initialRole
}: {
  vaultId: string;
  memberId: string;
  initialRole: ManageableRole;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"main" | "roles">("main");
  const [role, setRole] = useState<ManageableRole>(initialRole);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Always reopen on the main view so the slide starts from a known state.
  useEffect(() => {
    if (!open) setView("main");
  }, [open]);

  function selectRole(next: ManageableRole) {
    setOpen(false);
    if (next === role) return;

    const previous = role;
    setRole(next); // optimistic — reflect the new role immediately

    startTransition(async () => {
      try {
        const response = await fetch(`/api/vault/${vaultId}/members/${memberId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: next })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Unable to update member role");
        }
        router.refresh();
      } catch (error) {
        setRole(previous); // revert the optimistic change
        toast.error(error instanceof Error ? error.message : "Unable to update member role");
      }
    });
  }

  function removeMember() {
    setOpen(false);
    if (!window.confirm("Remove this member from the space?")) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/vault/${vaultId}/members/${memberId}`, {
          method: "DELETE"
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Unable to remove member");
        }
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to remove member");
      }
    });
  }

  return (
    <>
      <div className="member-role-col">
        <span className="member-role" data-role={role}>
          {role}
        </span>
      </div>
      <div className="member-actions-col">
        <div className="member-menu" ref={menuRef}>
          <button
            aria-label="Member options"
            className="member-menu__trigger"
            disabled={isPending}
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            <Icon name="dotsThree" />
          </button>
          {open ? (
            <div className="member-menu__dropdown">
              <div className={`member-menu__track${view === "roles" ? " member-menu__track--roles" : ""}`}>
                <div aria-hidden={view === "roles"} className="member-menu__panel">
                  <button
                    className="member-menu__item"
                    onClick={() => setView("roles")}
                    type="button"
                  >
                    Change role
                  </button>
                  <button
                    className="member-menu__item member-menu__item--danger"
                    onClick={removeMember}
                    type="button"
                  >
                    Delete user
                  </button>
                </div>
                <div aria-hidden={view !== "roles"} className="member-menu__panel">
                  {ROLE_OPTIONS.map((option) => (
                    <button
                      className="member-menu__item member-menu__role"
                      key={option}
                      onClick={() => selectRole(option)}
                      type="button"
                    >
                      <span>{option}</span>
                      {role === option ? (
                        <Icon className="member-menu__check" name="check" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
