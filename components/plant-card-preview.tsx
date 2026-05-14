import { buttonClassName } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PlantCardBase } from "@/components/plant-card-base";

type PlantCardPreviewProps = {
  name: string;
  imageUrl: string | null;
  scientificName?: string;
  onImageClick: () => void;
  onClearPhoto?: () => void;
  status: "overdue" | "today" | "upcoming";
  statusLabel: string;
  lastWateredText: string;
};

export function PlantCardPreview({
  name,
  imageUrl,
  scientificName,
  onImageClick,
  onClearPhoto,
  status,
  statusLabel,
  lastWateredText,
}: PlantCardPreviewProps) {
  return (
    <div className="plant-card-preview-wrapper">
      <PlantCardBase
        actions={
          <button
            className={buttonClassName({ variant: "secondary" })}
            type="button"
          >
            <Icon className="ui-button__icon" name="water" />
            <span className="ui-button__label">Mark watered</span>
          </button>
        }
        imageUrl={imageUrl}
        lastWateredText={lastWateredText}
        name={name}
        onImageClick={onImageClick}
        overlayLabel={imageUrl ? "Change photo" : "Add photo"}
        scientificName={scientificName}
        status={status}
        statusLabel={statusLabel}
      />
      {onClearPhoto ? (
        <button
          aria-label="Remove uploaded photo"
          className="plant-card-preview__clear"
          onClick={onClearPhoto}
          type="button"
        >
          <Icon name="close" />
        </button>
      ) : null}
    </div>
  );
}
