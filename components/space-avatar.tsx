"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";

const MAX_COVER_BYTES = 5 * 1024 * 1024;

export function SpaceAvatar({
  vaultId,
  imageUrl,
  name,
  canEdit,
  hasCustomCover
}: {
  vaultId: string;
  imageUrl: string | null;
  name: string;
  canEdit: boolean;
  hasCustomCover: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Unable to read the selected image"));
      reader.readAsDataURL(file);
    });
  }

  function patchCover(body: Record<string, unknown>, failureMessage: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/vault/${vaultId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? failureMessage);
        }
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : failureMessage);
      }
    });
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (file.size > MAX_COVER_BYTES) {
      toast.error("Image must be smaller than 5 MB");
      return;
    }

    let dataUrl: string;
    try {
      dataUrl = await readFileAsDataUrl(file);
    } catch {
      toast.error("Unable to read the selected image");
      return;
    }

    patchCover({ coverImage: dataUrl }, "Unable to update the space photo");
  }

  function resetToRandom() {
    patchCover({ removeCoverImage: true }, "Unable to reset the space photo");
  }

  return (
    <div className={`settings-space-card__avatar${isPending ? " is-uploading" : ""}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`${name} cover`} className="settings-space-card__avatar-img" src={imageUrl} />
      ) : (
        <Icon name="plantFill" />
      )}

      {canEdit ? (
        <>
          <input
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            onChange={onFileChange}
            ref={fileInputRef}
            type="file"
          />
          <div className="settings-space-card__avatar-actions">
            {hasCustomCover ? (
              <button
                aria-label="Use a random plant photo"
                className="settings-space-card__avatar-btn settings-space-card__avatar-btn--reset"
                disabled={isPending}
                onClick={resetToRandom}
                title="Use a random plant photo"
                type="button"
              >
                <Icon name="arrowClockwise" />
              </button>
            ) : null}
            <button
              aria-label="Change space photo"
              className="settings-space-card__avatar-btn"
              disabled={isPending}
              onClick={() => fileInputRef.current?.click()}
              title="Change space photo"
              type="button"
            >
              <Icon name="camera" />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
