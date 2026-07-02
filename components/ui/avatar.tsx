"use client";

import { useState } from "react";
import { cn, getInitials } from "@/lib/utils";

/**
 * Single source of truth for user avatars. Renders the user's photo (e.g. their
 * Google profile picture) when available and falls back to initials — both on a
 * missing URL and on a load error. Uses the shared `.avatar-chip` styles, so every
 * existing size/shape override keeps working; pass `className` for modifiers
 * (`avatar-chip--soft`, etc.).
 */
export function Avatar({
  name,
  email,
  imageUrl,
  className
}: {
  name?: string | null;
  email?: string | null;
  imageUrl?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const label = name ?? email ?? null;
  const showImage = Boolean(imageUrl) && !failed;

  return (
    <span className={cn("avatar-chip", className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={label ?? "Member"}
          className="avatar-chip__image"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          src={imageUrl as string}
        />
      ) : (
        getInitials(label)
      )}
    </span>
  );
}
