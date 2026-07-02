"use client";

import { ReactNode, ChangeEvent, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";
import { fileToDataUrl } from "@/lib/image-client";
import { formatDate } from "@/lib/time";
import { NotificationSettingForm } from "@/components/notification-setting-form";
import { MarkWateredButton } from "@/components/mark-watered-button";
import { StatusPill } from "@/components/status-pill";
import { Icon } from "@/components/ui/icon";

export function PlantDetailEditor({
  plantId,
  vaultId,
  vaultName,
  nickname: initialNickname,
  scientificName,
  imageUrl: initialImageUrl,
  nextWateringAt,
  wateringIntervalDays: initialWateringIntervalDays,
  lightRequirement,
  soilType,
  petToxic,
  fertilizerIntervalDays,
  careNotes,
  createdAt,
  notificationsEnabled,
  canEdit,
  scheduleContent,
  logContent,
  membersContent
}: {
  plantId: string;
  vaultId: string;
  vaultName: string;
  nickname: string;
  scientificName: string;
  imageUrl: string | null;
  createdAt: Date | string;
  nextWateringAt: Date | string;
  wateringIntervalDays: number;
  lightRequirement: string | null;
  soilType: string | null;
  petToxic: boolean | null;
  fertilizerIntervalDays: number | null;
  careNotes: string | null;
  notificationsEnabled: boolean;
  canEdit: boolean;
  scheduleContent: ReactNode;
  logContent: ReactNode;
  membersContent: ReactNode;
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
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef({
    nickname: initialNickname,
    wateringIntervalDays: initialWateringIntervalDays
  });

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (savedStateTimerRef.current) clearTimeout(savedStateTimerRef.current);
    };
  }, []);

  function cancelPendingAutosave() {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }

  function scheduleAutosave(next: { nickname: string; wateringIntervalDays: number }) {
    cancelPendingAutosave();
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void autosave(next);
    }, 900);
  }

  async function autosave(next: { nickname: string; wateringIntervalDays: number }) {
    const trimmedNickname = next.nickname.trim();

    if (!trimmedNickname) {
      return;
    }

    if (
      trimmedNickname === lastSavedRef.current.nickname &&
      next.wateringIntervalDays === lastSavedRef.current.wateringIntervalDays
    ) {
      return;
    }

    setAutosaveState("saving");

    const response = await fetch(`/api/plants/${plantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: trimmedNickname,
        wateringIntervalDays: next.wateringIntervalDays
      })
    }).catch(() => null);

    if (!response?.ok) {
      setAutosaveState("error");
      return;
    }

    lastSavedRef.current = {
      nickname: trimmedNickname,
      wateringIntervalDays: next.wateringIntervalDays
    };
    setAutosaveState("saved");
    router.refresh();

    if (savedStateTimerRef.current) clearTimeout(savedStateTimerRef.current);
    savedStateTimerRef.current = setTimeout(() => setAutosaveState("idle"), 2000);
  }

  function resetEditor() {
    cancelPendingAutosave();
    setNickname(lastSavedRef.current.nickname);
    setWateringIntervalDays(lastSavedRef.current.wateringIntervalDays);
    setImage(undefined);
    setImageName(null);
    setPreviewUrl(initialImageUrl);
    setError(null);
    setAutosaveState("idle");
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

  function saveChanges(event: { preventDefault(): void }) {
    event.preventDefault();
    setError(null);
    cancelPendingAutosave();

    startSaving(async () => {
      const response = await fetch(`/api/plants/${plantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), wateringIntervalDays, image })
      });

      const payload = await response.json().catch(() => ({ error: "Unable to update plant" }));

      if (!response.ok) {
        setError(payload.error ?? "Unable to update plant");
        return;
      }

      lastSavedRef.current = { nickname: nickname.trim(), wateringIntervalDays };
      setAutosaveState("idle");
      setIsEditing(false);
      router.refresh();
    });
  }

  const petToxicLabel =
    petToxic === null ? "Unknown" : petToxic ? "Toxic to cats and dogs" : "Pet safe";

  return (
    <form className="detail-layout" onSubmit={saveChanges}>
      {/* ── Breadcrumb ───────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="detail-breadcrumb">
        <Link href="/dashboard" className="detail-breadcrumb__link">{vaultName}</Link>
        <span className="detail-breadcrumb__sep">›</span>
        <span>{nickname}</span>
      </nav>

      {/* ── Left column ──────────────────────────────────────── */}
      <div className="detail-left-col">

        {/* Plant card — image + name */}
        <section className="detail-plant-card panel">
          {canEdit ? (
            <button
              aria-label={isEditing ? "Cancel editing" : "Edit plant"}
              className="detail-hero-edit"
              onClick={isEditing
                ? (e) => { e.preventDefault(); resetEditor(); setIsEditing(false); }
                : (e) => { e.preventDefault(); resetEditor(); setIsEditing(true); }
              }
              type="button"
            >
              <Icon name={isEditing ? "close" : "edit"} />
            </button>
          ) : null}

          {isEditing ? (
            <label className="detail-media detail-media-upload">
              <input accept="image/*" className="sr-only" onChange={onImageChange} type="file" />
              {previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={nickname} src={previewUrl} />
                  <span className="upload-overlay">Change photo</span>
                </>
              ) : (
                <div className="detail-placeholder">
                  <span>{nickname.slice(0, 1).toUpperCase()}</span>
                  <span className="upload-overlay">Upload photo</span>
                </div>
              )}
              <div className="detail-status-overlay">
                <StatusPill nextWateringAt={nextWateringAt} />
              </div>
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
              <div className="detail-status-overlay">
                <StatusPill nextWateringAt={nextWateringAt} />
              </div>
            </div>
          )}

          <div className="detail-plant-card-body">
            {isEditing ? (
              <input
                className="detail-title-input"
                onChange={(e) => {
                  setNickname(e.target.value);
                  setError(null);
                  scheduleAutosave({ nickname: e.target.value, wateringIntervalDays });
                }}
                required
                value={nickname}
              />
            ) : (
              <h1>{nickname}</h1>
            )}
            <p className="detail-plant-sci-name">{scientificName}</p>
            <div className="detail-plant-meta">
              <div className="detail-plant-meta-item">
                <Icon name="calendarFill" />
                <div>
                  <span className="eyebrow">Added on</span>
                  <span className="detail-plant-meta-value">{formatDate(createdAt)}</span>
                </div>
              </div>
              <div className="detail-plant-meta-divider" aria-hidden="true" />
              <div className="detail-plant-meta-item">
                <Icon name="home" />
                <div>
                  <span className="eyebrow">Space</span>
                  <span className="detail-plant-meta-value">{vaultName}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Watering + notifications panel */}
        <section className="detail-watering-panel panel">
          <div className="detail-watering-header">
            <span className="detail-watering-icon-wrap">
              <Icon name="water" />
            </span>
            <div className="detail-watering-info">
              <span className="eyebrow">Watering needs</span>
              {isEditing ? (
                <div className="detail-watering-edit">
                  <span className="detail-watering-value">Every</span>
                  <input
                    className="detail-watering-input"
                    max={45}
                    min={1}
                    onChange={(e) => {
                      const nextInterval = Math.max(1, Math.min(45, Number(e.target.value)));
                      setWateringIntervalDays(nextInterval);
                      scheduleAutosave({ nickname, wateringIntervalDays: nextInterval });
                    }}
                    type="number"
                    value={wateringIntervalDays}
                  />
                  <span className="detail-watering-value">days</span>
                </div>
              ) : (
                <span className="detail-watering-value">Every {wateringIntervalDays} days</span>
              )}
            </div>
          </div>

          <MarkWateredButton className="detail-watered-full" icon="water" plantId={plantId} variant="primary" />

          <hr className="detail-divider" />

          <div className="detail-reminder-row">
            <Icon className="detail-reminder-icon" name="notificationFill" />
            <NotificationSettingForm
              endpoint={`/api/plants/${plantId}/notifications`}
              initialEmailEnabled={notificationsEnabled}
              label="Send watering reminders"
              variant="switch"
            />
          </div>
        </section>

        {/* Shared Access */}
        {membersContent}

        {canEdit && isEditing ? (
          <div className="inline-actions detail-save-row">
            {imageName ? <p className="muted detail-note">{imageName}</p> : null}
            {error ? <p className="field-error">{error}</p> : null}
            {autosaveState !== "idle" ? (
              <span
                className={
                  autosaveState === "error"
                    ? "detail-autosave-state detail-autosave-state--error"
                    : "detail-autosave-state"
                }
                role="status"
              >
                {autosaveState === "saving"
                  ? "Saving…"
                  : autosaveState === "saved"
                    ? "Saved"
                    : "Couldn't save — check your connection"}
              </span>
            ) : null}
            <button
              aria-label={isSaving ? "Saving…" : "Save changes"}
              className={buttonClassName({ variant: "primary", size: "icon" })}
              disabled={isSaving}
              type="submit"
            >
              <Icon className="ui-button__icon" name="saveFill" />
            </button>
          </div>
        ) : null}

        {!canEdit ? (
          <p className="muted">
            Members can water plants, but only owners and editors can change plant details or
            delete them from the space.
          </p>
        ) : null}
      </div>

      {/* ── Right column ─────────────────────────────────────── */}
      <div className="detail-right-col">

        {/* Care Profile */}
        <article className="panel stack-md detail-care-panel">
          <h2 className="detail-section-title">Care Profile</h2>

          <div className="detail-care-features">
            <div className="detail-care-top-row">
              <div className="detail-care-feature">
                <div className="detail-care-feature__icon-wrap">
                  <Icon className="detail-care-feature__icon" name="plantFill" />
                </div>
                <span className="eyebrow">Species</span>
                <span className="detail-care-feature__value">{scientificName}</span>
              </div>
              <div className="detail-care-feature">
                <div className="detail-care-feature__icon-wrap">
                  <Icon className="detail-care-feature__icon" name="sunFill" />
                </div>
                <span className="eyebrow">Light</span>
                <span className="detail-care-feature__value">{lightRequirement ?? "Not set"}</span>
              </div>
              <div className="detail-care-feature">
                <div className="detail-care-feature__icon-wrap">
                  <Icon className="detail-care-feature__icon" name="soilIcon" />
                </div>
                <span className="eyebrow">Soil</span>
                <span className="detail-care-feature__value">{soilType ?? "Not set"}</span>
              </div>
            </div>

            <hr className="detail-divider" />

            <div className="detail-care-bottom-row">
              <div className="detail-care-feature">
                <div className="detail-care-feature__icon-wrap">
                  <Icon className="detail-care-feature__icon" name="flaskFill" />
                </div>
                <div className="detail-care-feature__text">
                  <span className="eyebrow">Fertilizer</span>
                  <span className="detail-care-feature__value">
                    {fertilizerIntervalDays ? `Every ${fertilizerIntervalDays} days` : "Not set"}
                  </span>
                </div>
              </div>
              <div className="detail-care-feature">
                <div className="detail-care-feature__icon-wrap">
                  <Icon className="detail-care-feature__icon" name="pawFill" />
                </div>
                <div className="detail-care-feature__text">
                  <span className="eyebrow">Pet toxicity</span>
                  <span className="detail-care-feature__value">{petToxicLabel}</span>
                </div>
              </div>
            </div>
          </div>

          {careNotes ? (
            <div className="detail-care-description">
              <p>{careNotes}</p>
            </div>
          ) : null}
        </article>

        {/* Schedule */}
        <div className="detail-schedule-wrap">
          {scheduleContent}
        </div>

        {/* Watering Log */}
        {logContent}
      </div>
    </form>
  );
}
