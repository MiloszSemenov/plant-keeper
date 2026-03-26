"use client";

import Link from "next/link";
import { ReactNode, ChangeEvent, FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fileToDataUrl } from "@/lib/image-client";
import { NotificationSettingForm } from "@/components/notification-setting-form";
import { MarkWateredButton } from "@/components/mark-watered-button";
import { StatusPill } from "@/components/status-pill";

function formatIntervalLabel(days: number) {
  return days === 1 ? "1 day" : `${days} days`;
}

export function PlantDetailEditor({
  plantId,
  vaultId,
  vaultName,
  nickname: initialNickname,
  scientificName,
  imageUrl: initialImageUrl,
  nextWateringAt,
  wateringIntervalDays: initialWateringIntervalDays,
  recommendedWateringIntervalDays,
  observedWateringIntervalDays,
  observedWateringEventCount,
  lightRequirement,
  soilType,
  petToxic,
  fertilizerIntervalDays,
  careNotes,
  notificationsEnabled,
  canEdit,
  children
}: {
  plantId: string;
  vaultId: string;
  vaultName: string;
  nickname: string;
  scientificName: string;
  imageUrl: string | null;
  nextWateringAt: Date | string;
  wateringIntervalDays: number;
  recommendedWateringIntervalDays: number;
  observedWateringIntervalDays: number | null;
  observedWateringEventCount: number;
  lightRequirement: string | null;
  soilType: string | null;
  petToxic: boolean | null;
  fertilizerIntervalDays: number | null;
  careNotes: string | null;
  notificationsEnabled: boolean;
  canEdit: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(initialNickname);
  const [wateringIntervalDays, setWateringIntervalDays] = useState(initialWateringIntervalDays);
  const [image, setImage] = useState<string | undefined>();
  const [previewUrl, setPreviewUrl] = useState(initialImageUrl);
  const [imageName, setImageName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  function resetEditor() {
    setNickname(initialNickname);
    setWateringIntervalDays(initialWateringIntervalDays);
    setImage(undefined);
    setImageName(null);
    setPreviewUrl(initialImageUrl);
    setError(null);
  }

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setImage(undefined);
      setImageName(null);
      setPreviewUrl(initialImageUrl);
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setImage(dataUrl);
      setImageName(file.name);
      setPreviewUrl(dataUrl);
      setError(null);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Unable to load the image");
    }
  }

  function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startSaving(async () => {
      const response = await fetch(`/api/plants/${plantId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          wateringIntervalDays,
          image
        })
      });

      const payload = await response.json().catch(() => ({ error: "Unable to update plant" }));

      if (!response.ok) {
        setError(payload.error ?? "Unable to update plant");
        return;
      }

      setIsEditing(false);
      router.refresh();
    });
  }

  function deletePlant() {
    if (!window.confirm("Delete this plant from the space?")) {
      return;
    }

    setError(null);

    startDeleting(async () => {
      const response = await fetch(`/api/plants/${plantId}`, {
        method: "DELETE"
      });

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
      <section className="detail-hero panel">
        <form className="detail-hero-copy" onSubmit={saveChanges}>
          <Link className="back-link" href={`/dashboard?vaultId=${vaultId}`}>
            Back to dashboard
          </Link>
          <p className="eyebrow">{vaultName}</p>
          {isEditing ? (
            <input
              className="detail-title-input"
              onChange={(event) => {
                setNickname(event.target.value);
                setError(null);
              }}
              required
              value={nickname}
            />
          ) : (
            <h1>{nickname}</h1>
          )}
          <p>{scientificName}</p>
          <div className="inline-actions">
            <StatusPill nextWateringAt={nextWateringAt} />
            <MarkWateredButton plantId={plantId} />
            <NotificationSettingForm
              endpoint={`/api/plants/${plantId}/notifications`}
              initialEmailEnabled={notificationsEnabled}
              label="Send watering reminders for this plant"
              variant="switch"
            />
            {canEdit ? (
              isEditing ? (
                <>
                  <button className="button button-primary" disabled={isSaving} type="submit">
                    {isSaving ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    className="button button-ghost"
                    onClick={() => {
                      resetEditor();
                      setIsEditing(false);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="button button-danger"
                    disabled={isDeleting}
                    onClick={deletePlant}
                    type="button"
                  >
                    {isDeleting ? "Deleting..." : "Delete plant"}
                  </button>
                </>
              ) : (
                <button
                  className="button button-ghost"
                  onClick={() => {
                    resetEditor();
                    setIsEditing(true);
                  }}
                  type="button"
                >
                  Edit
                </button>
              )
            ) : null}
          </div>
          {!canEdit ? (
            <p className="muted">
              Members can water plants, but only owners and editors can change plant details or
              delete them from the space.
            </p>
          ) : null}
          {isEditing && imageName ? <p className="muted">Ready: {imageName}</p> : null}
          {error ? <p className="field-error">{error}</p> : null}
        </form>
        {isEditing ? (
          <label className="detail-media detail-media-upload">
            <input accept="image/*" className="sr-only" onChange={onImageChange} type="file" />
            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={nickname} src={previewUrl} />
                <span className="upload-overlay">Replace photo</span>
              </>
            ) : (
              <div className="detail-placeholder">
                <span>{nickname.slice(0, 1).toUpperCase()}</span>
                <span className="upload-overlay">Upload photo</span>
              </div>
            )}
          </label>
        ) : (
          <div className="detail-media">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={nickname} src={previewUrl} />
            ) : (
              <div className="detail-placeholder">
                <span>{nickname.slice(0, 1).toUpperCase()}</span>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="detail-grid">
        <article className="panel stack-sm">
          <p className="eyebrow">Care profile</p>
          <h2>Watering and light</h2>
          <dl className="detail-list">
            <div>
              <dt>Water every</dt>
              <dd>
                {isEditing ? (
                  <div className="stack-xs">
                    <div className="interval-stepper">
                      <button
                        className="button button-ghost"
                        onClick={() => setWateringIntervalDays((value) => Math.max(1, value - 1))}
                        type="button"
                      >
                        -
                      </button>
                      <strong>{formatIntervalLabel(wateringIntervalDays)}</strong>
                      <button
                        className="button button-ghost"
                        onClick={() => setWateringIntervalDays((value) => Math.min(45, value + 1))}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                    <p className="muted detail-note">
                      Recommended: every {formatIntervalLabel(recommendedWateringIntervalDays)}
                      {observedWateringIntervalDays
                        ? ` (users water this plant every ${formatIntervalLabel(observedWateringIntervalDays)} based on ${observedWateringEventCount} events)`
                        : ""}
                    </p>
                  </div>
                ) : (
                  `${wateringIntervalDays} days`
                )}
              </dd>
            </div>
            <div>
              <dt>Species</dt>
              <dd>{scientificName}</dd>
            </div>
            <div>
              <dt>Light</dt>
              <dd>{lightRequirement ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Soil</dt>
              <dd>{soilType ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Pet toxicity</dt>
              <dd>
                {petToxic === null ? "Unknown" : petToxic ? "Toxic to pets" : "Pet safe"}
              </dd>
            </div>
            <div>
              <dt>Fertilizer</dt>
              <dd>
                {fertilizerIntervalDays ? `Every ${fertilizerIntervalDays} days` : "Not set"}
              </dd>
            </div>
          </dl>
          <p className="muted">{careNotes ?? "No care notes saved yet."}</p>
        </article>
        {children}
      </section>
    </>
  );
}
