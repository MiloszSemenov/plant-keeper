"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition
} from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { fileToDataUrl } from "@/lib/image-client";
import { normalizePlantLookupKey } from "@/lib/plants";
import { cn } from "@/lib/utils";
import { PlantCardPreview } from "@/components/plant-card-preview";

type VaultOption = {
  id: string;
  name: string;
};

type PhotoSuggestion = {
  species: string;
  confidence?: number;
  accessToken?: string | null;
  commonNames: string[];
  description: string | null;
  url: string | null;
  imageUrl?: string | null;
};

type SpeciesSuggestion = {
  latinName: string;
  commonName?: string;
  imageUrl: string | null;
};

type SpeciesSource = "manual" | "photo" | "suggestion";

type SuggestionListItem = {
  key: string;
  latinName: string;
  commonName?: string;
  imageUrl: string | null;
  confidence?: number;
  photoSuggestion?: PhotoSuggestion;
  speciesSuggestion?: SpeciesSuggestion;
};

export function AddPlantForm({
  vaults,
  initialVaultId
}: {
  vaults: VaultOption[];
  initialVaultId: string;
}) {
  const router = useRouter();
  const photoInputId = useId();
  const nicknameInputId = useId();
  const spaceFieldLabelId = useId();
  const [vaultId, setVaultId] = useState(initialVaultId);
  const [nickname, setNickname] = useState("");
  const [speciesQuery, setSpeciesQuery] = useState("");
  const [speciesSource, setSpeciesSource] = useState<SpeciesSource>("manual");
  const [image, setImage] = useState<string | undefined>();
  const [imageName, setImageName] = useState<string | null>(null);
  const [photoSuggestions, setPhotoSuggestions] = useState<PhotoSuggestion[]>([]);
  const [speciesSuggestions, setSpeciesSuggestions] = useState<SpeciesSuggestion[]>([]);
  const [selectedPhotoSuggestion, setSelectedPhotoSuggestion] = useState<PhotoSuggestion | null>(null);
  const [selectedSpeciesSuggestion, setSelectedSpeciesSuggestion] =
    useState<SpeciesSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastIdentifiedImage, setLastIdentifiedImage] = useState<string | null>(null);
  const [identifyPending, startIdentify] = useTransition();
  const [createPending, startCreate] = useTransition();
  const [searchPending, startSearch] = useTransition();
  const lastSearchQueryRef = useRef<string>("");
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const speciesSuggestionCacheRef = useRef(new Map<string, SpeciesSuggestion[]>());
  const photoInputRef = useRef<HTMLInputElement>(null);
  const previewWatering = {
    status: "today" as const,
    statusLabel: "Water today",
    lastWateredText: "3 days ago",
  };

  useEffect(() => {
    const trimmedQuery = speciesQuery.trim();
    const normalizedQuery = normalizePlantLookupKey(trimmedQuery);

    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
      searchAbortControllerRef.current = null;
    }

    if (speciesSource !== "manual") {
      return;
    }

    if (trimmedQuery.length < 3 || !normalizedQuery) {
      setSpeciesSuggestions([]);
      lastSearchQueryRef.current = "";
      return;
    }

    const cachedSuggestions = speciesSuggestionCacheRef.current.get(normalizedQuery);

    if (cachedSuggestions) {
      setSpeciesSuggestions(cachedSuggestions);
      lastSearchQueryRef.current = normalizedQuery;
      return;
    }

    if (normalizedQuery === lastSearchQueryRef.current) {
      return;
    }

    lastSearchQueryRef.current = normalizedQuery;

    const timeoutId = window.setTimeout(() => {
      const controller = new AbortController();
      searchAbortControllerRef.current = controller;

      startSearch(async () => {
        try {
          const response = await fetch(
            `/api/plant-species/suggest?q=${encodeURIComponent(trimmedQuery)}`,
            {
              signal: controller.signal
            }
          ).catch(() => null);

          if (!response || controller.signal.aborted) {
            return;
          }

          const payload = await response.json().catch(() => []);

          if (!response.ok) {
            if (!controller.signal.aborted) {
              lastSearchQueryRef.current = "";
              setError(payload.error ?? "Unable to search plant species");
            }
            return;
          }

          const suggestions = Array.isArray(payload) ? payload : [];
          speciesSuggestionCacheRef.current.set(normalizedQuery, suggestions);
          lastSearchQueryRef.current = normalizedQuery;
          setSpeciesSuggestions(suggestions);
        } finally {
          if (searchAbortControllerRef.current === controller) {
            searchAbortControllerRef.current = null;
          }
        }
      });
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);

      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
        searchAbortControllerRef.current = null;
      }
    };
  }, [speciesQuery, speciesSource]);

  function clearPhoto() {
    setImage(undefined);
    setImageName(null);
    setPhotoSuggestions([]);
    setSelectedPhotoSuggestion(null);
    setLastIdentifiedImage(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  }

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      clearPhoto();
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setError(null);
      setImage(dataUrl);
      setImageName(file.name);
      setPhotoSuggestions([]);
      setSelectedPhotoSuggestion(null);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Unable to load the image");
      clearPhoto();
    }
  }

  function identifyPlant() {
    if (!image) {
      setError("Upload a photo first so Plant Keeper can identify the species.");
      return;
    }

    if (image === lastIdentifiedImage) {
      return;
    }

    setError(null);

    startIdentify(async () => {
      const response = await fetch("/api/plant/identify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ image })
      });

      const payload = await response.json().catch(() => ({ error: "Unable to identify plant" }));

      if (!response.ok) {
        setError(payload.error ?? "Unable to identify plant");
        return;
      }

      setLastIdentifiedImage(image);
      setPhotoSuggestions(payload.suggestions ?? []);
      setSelectedPhotoSuggestion(null);
      if (payload.suggestions?.[0]?.species) {
        setSpeciesQuery(payload.suggestions[0].species);
        setSpeciesSource("photo");
        setSpeciesSuggestions([]);
        lastSearchQueryRef.current = "";
      } else {
        setError("We couldn't recognize this plant from the photo. Try a closer, well-lit photo, or search by name instead.");
      }
    });
  }

  function getSelectedLatinName() {
    return selectedSpeciesSuggestion?.latinName ?? selectedPhotoSuggestion?.species ?? null;
  }

  function getConfirmedCommonName(selectedLatinName: string) {
    const trimmedQuery = speciesQuery.trim();

    if (!trimmedQuery) {
      return undefined;
    }

    return normalizePlantLookupKey(trimmedQuery) === normalizePlantLookupKey(selectedLatinName)
      ? undefined
      : trimmedQuery;
  }

  function getSelectedImageUrl() {
    return selectedSpeciesSuggestion?.imageUrl ?? selectedPhotoSuggestion?.imageUrl ?? undefined;
  }

  function selectSuggestion(item: SuggestionListItem) {
    if (item.speciesSuggestion) {
      setSelectedSpeciesSuggestion(item.speciesSuggestion);
      setSelectedPhotoSuggestion(null);
      setSpeciesQuery(item.speciesSuggestion.commonName ?? item.speciesSuggestion.latinName);
      setSpeciesSource("suggestion");
      setError(null);
      return;
    }

    if (item.photoSuggestion) {
      setSelectedPhotoSuggestion(item.photoSuggestion);
      setSelectedSpeciesSuggestion(null);
      setSpeciesQuery(item.photoSuggestion.species);
      setSpeciesSource("suggestion");
      setSpeciesSuggestions([]);
      lastSearchQueryRef.current = "";
      setError(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const selectedLatinName = getSelectedLatinName();

    if (!selectedLatinName) {
      setError("Select a species suggestion before saving this plant.");
      return;
    }

    startCreate(async () => {
      const confirmResponse = await fetch("/api/plant-species/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          latinName: selectedLatinName,
          commonName: getConfirmedCommonName(selectedLatinName),
          imageUrl: getSelectedImageUrl()
        })
      });

      const confirmPayload = await confirmResponse
        .json()
        .catch(() => ({ error: "Unable to confirm plant species" }));

      if (!confirmResponse.ok) {
        setError(confirmPayload.error ?? "Unable to confirm plant species");
        return;
      }

      const response = await fetch("/api/plants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          vaultId,
          nickname: nickname.trim(),
          speciesId: confirmPayload.speciesId,
          image
        })
      });

      const payload = await response.json().catch(() => ({ error: "Unable to create plant" }));

      if (!response.ok) {
        setError(payload.error ?? "Unable to create plant");
        return;
      }

      router.push(`/plant/${payload.plant.id}`);
      router.refresh();
    });
  }

  const suggestionMap = new Map<string, SuggestionListItem>();

  for (const suggestion of photoSuggestions) {
    const key = normalizePlantLookupKey(suggestion.species);

    if (!key) {
      continue;
    }

    suggestionMap.set(key, {
      key,
      latinName: suggestion.species,
      commonName: suggestion.commonNames[0],
      imageUrl: suggestion.imageUrl ?? null,
      confidence: suggestion.confidence,
      photoSuggestion: suggestion
    });
  }

  for (const suggestion of speciesSuggestions) {
    const key = normalizePlantLookupKey(suggestion.latinName);

    if (!key) {
      continue;
    }

    const existingSuggestion = suggestionMap.get(key);

    if (existingSuggestion) {
      suggestionMap.set(key, {
        ...existingSuggestion,
        commonName: existingSuggestion.commonName ?? suggestion.commonName,
        imageUrl: existingSuggestion.imageUrl ?? suggestion.imageUrl,
        speciesSuggestion: suggestion
      });
      continue;
    }

    suggestionMap.set(key, {
      key,
      latinName: suggestion.latinName,
      commonName: suggestion.commonName,
      imageUrl: suggestion.imageUrl,
      speciesSuggestion: suggestion
    });
  }

  const visibleSuggestions = [...suggestionMap.values()].sort((a, b) => {
    const aIsPhoto = Boolean(a.photoSuggestion);
    const bIsPhoto = Boolean(b.photoSuggestion);

    if (aIsPhoto !== bIsPhoto) {
      return aIsPhoto ? -1 : 1;
    }

    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });
  const selectedLatinName = getSelectedLatinName();
  const selectedSuggestionKey = selectedLatinName
    ? normalizePlantLookupKey(selectedLatinName)
    : null;
  const hasSelection = Boolean(selectedLatinName);
  const showPreview = hasSelection || Boolean(image);
  const canSavePlant = hasSelection && !createPending;

  const previewName = nickname.trim() || speciesQuery.trim() || "Your plant";
  const previewImageUrl = image ?? selectedSpeciesSuggestion?.imageUrl ?? selectedPhotoSuggestion?.imageUrl ?? null;
  const previewScientificName = selectedLatinName ?? undefined;

  return (
    <form className={cn("add-plant-flow", showPreview && "add-plant-flow--with-preview")} onSubmit={onSubmit}>
      <input
        accept="image/*"
        className="sr-only"
        id={photoInputId}
        onChange={onImageChange}
        ref={photoInputRef}
        type="file"
      />

      <div className="add-plant-main">
        <section className="add-plant-search-hero">
          <div className="add-plant-search-copy">
            <h2 className="add-plant-search-title">Plant&apos;s name</h2>
            <Input
              aria-label="Plant name"
              autoFocus
              containerClassName="add-plant-name-input"
              onChange={(event) => {
                setSpeciesQuery(event.target.value);
                setSpeciesSource("manual");
                setSelectedSpeciesSuggestion(null);
                setSelectedPhotoSuggestion(null);
                setError(null);
              }}
              placeholder="Search or type a plant name..."
              required
              rightAction={
                <button
                  aria-label="Upload plant photo"
                  className="ui-input__right-action"
                  onClick={() => photoInputRef.current?.click()}
                  type="button"
                >
                  <Icon name="camera" />
                </button>
              }
              type="search"
              value={speciesQuery}
            />
            <div className="add-plant-identify-btn">
              <Button
                disabled={!image || identifyPending || image === lastIdentifiedImage}
                icon="cameraFill"
                onClick={identifyPlant}
                type="button"
                variant="subtle"
              >
                {identifyPending
                  ? "Identifying..."
                  : image && image === lastIdentifiedImage
                    ? "Photo identified"
                    : "Identify from photo"}
              </Button>
              {!image ? (
                <p className="add-plant-identify-hint">Upload a photo of your plant first</p>
              ) : image === lastIdentifiedImage ? (
                <p className="add-plant-identify-hint">Upload a different photo to identify again</p>
              ) : null}
            </div>
          </div>

          {searchPending || visibleSuggestions.length > 0 ? (
            <p className="muted add-plant-suggestions-label">
              {searchPending
                ? "Searching..."
                : visibleSuggestions.length === 1
                  ? "We found a match"
                  : "Pick the closest match"}
            </p>
          ) : null}

          {visibleSuggestions.length > 0 ? (
            <div className="add-plant-suggestions">
              {visibleSuggestions.map((suggestion) => {
                const displayName = suggestion.commonName ?? suggestion.latinName;
                const hasSecondaryName =
                  suggestion.commonName &&
                  normalizePlantLookupKey(suggestion.commonName) !==
                    normalizePlantLookupKey(suggestion.latinName);
                const isActive = selectedSuggestionKey === suggestion.key;

                return (
                  <button
                    className={cn(
                      cardClassName({
                        className: "add-plant-suggestion",
                        padding: "none"
                      }),
                      isActive && "add-plant-suggestion--active"
                    )}
                    key={suggestion.key}
                    onClick={() => selectSuggestion(suggestion)}
                    type="button"
                  >
                    <span className="add-plant-suggestion__media">
                      {suggestion.imageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt={displayName} draggable={false} src={suggestion.imageUrl} />
                        </>
                      ) : (
                        <span className="add-plant-suggestion__placeholder">
                          <Icon className="add-plant-suggestion__icon" name="plant" />
                          <span>{displayName.slice(0, 1).toUpperCase()}</span>
                        </span>
                      )}
                    </span>

                    <span className="add-plant-suggestion__body">
                      <span className="add-plant-suggestion__header">
                        {isActive ? (
                          <Badge tone="accent" uppercase>
                            Selected
                          </Badge>
                        ) : null}
                      </span>
                      {suggestion.confidence ? (
                        <span className="add-plant-suggestion__meta">
                          {Math.round(suggestion.confidence * 100)}% photo match
                        </span>
                      ) : null}
                      <strong className="add-plant-suggestion__title">{displayName}</strong>
                      {hasSecondaryName ? (
                        <span className="add-plant-suggestion__subtitle">{suggestion.latinName}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {speciesSource === "manual" &&
          speciesQuery.trim().length >= 3 &&
          !searchPending &&
          speciesSuggestions.length === 0 &&
          photoSuggestions.length === 0 ? (
            <p className="muted add-plant-empty-state">
              No matches yet. Try a more specific name.
            </p>
          ) : null}
        </section>

        {hasSelection ? <div className="add-plant-details">
          <h3 className="add-plant-details-title">Plant details</h3>

          <div className="field add-plant-detail-field">
            <label className="field-label" htmlFor={nicknameInputId}>
              Nickname
            </label>
            <Input
              containerClassName="add-plant-nickname-input"
              id={nicknameInputId}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Give your plant a nickname..."
              value={nickname}
            />
          </div>

          <div className="field add-plant-detail-field">
            <p className="field-label" id={spaceFieldLabelId}>
              Space:
            </p>
            <div aria-labelledby={spaceFieldLabelId} className="space-picker" role="group">
              {vaults.map((vault) => (
                <button
                  aria-pressed={vaultId === vault.id}
                  className={cn(
                    "space-picker__pill",
                    vaultId === vault.id && "space-picker__pill--active"
                  )}
                  key={vault.id}
                  onClick={() => setVaultId(vault.id)}
                  type="button"
                >
                  {vault.name}
                </button>
              ))}
            </div>
          </div>
        </div> : null}

        {error ? <p className="field-error">{error}</p> : null}

        {hasSelection ? <div className="add-plant-footer">
          <Button disabled={!canSavePlant} icon="save_plant" size="lg" type="submit" variant="primary">
            {createPending ? "Saving plant..." : "Save plant"}
          </Button>
        </div> : null}
      </div>

      {showPreview ? <div aria-hidden="true" className="add-plant-divider" /> : null}

      {showPreview ? (
        <aside className="add-plant-preview">
          <p className="add-plant-preview-label">Preview</p>
          <PlantCardPreview
            imageUrl={previewImageUrl}
            lastWateredText={previewWatering.lastWateredText}
            name={previewName}
            onClearPhoto={image ? clearPhoto : undefined}
            onImageClick={() => photoInputRef.current?.click()}
            scientificName={previewScientificName}
            status={previewWatering.status}
            statusLabel={previewWatering.statusLabel}
          />
        </aside>
      ) : null}
    </form>
  );
}
