"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PlantCardStatus = "overdue" | "today" | "upcoming";

type PlantCardBaseProps = {
  name: string;
  scientificName?: string;
  imageUrl: string | null;

  // media area — mutually exclusive
  mediaHref?: string;        // link to plant detail (PlantCard)
  onImageClick?: () => void; // open file picker (PlantCardPreview)
  overlayLabel?: string;     // "Add photo" / "Change photo"

  // status badge
  status?: PlantCardStatus;
  statusLabel?: string;

  // card body
  lastWateredText?: string;
  actions?: ReactNode;
};

const STATUS_TONE: Record<PlantCardStatus, BadgeTone> = {
  overdue: "danger",
  today: "warning",
  upcoming: "success",
};

export function PlantCardBase({
  name,
  scientificName,
  imageUrl,
  mediaHref,
  onImageClick,
  overlayLabel,
  status,
  statusLabel,
  lastWateredText,
  actions,
}: PlantCardBaseProps) {
  const showScientificName = scientificName && scientificName !== name;
  const isOverdue = status === "overdue";
  const isDataUrl = imageUrl?.startsWith("data:");

  const mediaContent = (
    <>
      {imageUrl ? (
        isDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={name} src={imageUrl} />
        ) : (
          <Image alt={name} fill src={imageUrl} />
        )
      ) : (
        <span className="plant-card-placeholder">
          <Icon className="plant-card-placeholder__icon" name="plant" />
          <span>{name.slice(0, 1).toUpperCase() || "?"}</span>
        </span>
      )}
      {status && statusLabel && (
        <div className="plant-card-status">
          <Badge
            className={cn("status-pill", `status-${STATUS_TONE[status]}`)}
            tone={STATUS_TONE[status]}
          >
            {statusLabel}
          </Badge>
        </div>
      )}
      {overlayLabel && (
        <span className="upload-overlay">{overlayLabel}</span>
      )}
    </>
  );

  return (
    <Card
      className={cn("plant-card", isOverdue && "plant-card--danger")}
      padding="none"
      tone={isOverdue ? "danger" : "default"}
    >
      {mediaHref ? (
        <Link className="plant-card-media" href={mediaHref}>
          {mediaContent}
        </Link>
      ) : onImageClick ? (
        <button
          className="plant-card-media plant-card-preview__media"
          onClick={onImageClick}
          type="button"
        >
          {mediaContent}
        </button>
      ) : (
        <div className="plant-card-media">{mediaContent}</div>
      )}

      <div className="plant-card-body">
        <div className="stack-sm">
          <div>
            <h3>{name}</h3>
            {showScientificName && (
              <p className="text-muted text-sm">{scientificName}</p>
            )}
          </div>
          {lastWateredText && (
            <p
              className={cn(
                "plant-card-caption",
                isOverdue && "plant-card-caption--warning"
              )}
            >
              Last watered {lastWateredText}
            </p>
          )}
        </div>
        {actions && <div className="plant-card-actions">{actions}</div>}
      </div>
    </Card>
  );
}
