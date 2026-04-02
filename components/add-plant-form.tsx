"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
  useTransition
} from "react";
import { useRouter } from "next/navigation";
import { fileToDataUrl } from "@/lib/image-client";
import { normalizePlantLookupKey } from "@/lib/plants";

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

export function AddPlantForm({
  vaults,
  initialVaultId
}: {
  vaults: VaultOption[];
  initialVaultId: string;
}) {
  const router = useRouter();
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
  const [identifyPending, startIdentify] = useTransition();
  const [createPending, startCreate] = useTransition();
  const [searchPending, startSearch] = useTransition();
  const lastSearchQueryRef = useRef<string>("");
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const speciesSuggestionCacheRef = useRef(new Map<string, SpeciesSuggestion[]>());

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

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setImage(undefined);
      setImageName(null);
      setPhotoSuggestions([]);
      setSelectedPhotoSuggestion(null);
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
      setImage(undefined);
      setImageName(null);
      setPhotoSuggestions([]);
      setSelectedPhotoSuggestion(null);
    }
  }

  function identifyPlant() {
    if (!image) {
      setError("Upload a photo first so Plant Keeper can identify the species.");
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

      setPhotoSuggestions(payload.suggestions ?? []);
      setSelectedPhotoSuggestion(null);
      if (payload.suggestions?.[0]?.species) {
        setSpeciesQuery(payload.suggestions[0].species);
        setSpeciesSource("photo");
        setSpeciesSuggestions([]);
        lastSearchQueryRef.current = "";
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

  const canSavePlant = Boolean(getSelectedLatinName()) && !createPending;

  return (
    <form className="panel stack-md" onSubmit={onSubmit}>
      <div className="stack-xs">
        <p className="eyebrow">Add plant</p>
        <h2>Add a plant to your space</h2>
        <p>
          Drop in a photo for instant suggestions, or type a plant name and select one Latin-name
          match before saving.
        </p>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Space</span>
          <select onChange={(event) => setVaultId(event.target.value)} value={vaultId}>
            {vaults.map((vault) => (
              <option key={vault.id} value={vault.id}>
                {vault.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Nickname (optional)</span>
          <input
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Living room Monstera"
            value={nickname}
          />
        </label>
      </div>

      <label className="upload-field">
        <span className="field-label">Plant photo</span>
        <input accept="image/*" className="sr-only" onChange={onImageChange} type="file" />
        <span className="upload-card">
          {image ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={imageName ?? "Plant preview"} className="upload-preview" src={image} />
              <span className="upload-overlay">Swap photo</span>
            </>
          ) : (
            <span className="upload-placeholder">
              <strong>Choose a photo</strong>
              <small>JPG, PNG, WebP, or HEIC under 5 MB.</small>
            </span>
          )}
        </span>
        <small>{imageName ? `Ready: ${imageName}` : "A clear leaf photo usually works best."}</small>
      </label>

      <div className="inline-actions">
        <button
          className="button button-secondary"
          disabled={!image || identifyPending}
          onClick={identifyPlant}
          type="button"
        >
          {identifyPending ? "Identifying..." : "Identify from photo"}
        </button>
        {photoSuggestions.length > 0 ? (
          <p className="muted">Pick one of the photo matches or keep searching by name.</p>
        ) : null}
      </div>

      {photoSuggestions.length > 0 ? (
        <div className="stack-sm">
          <div className="section-heading">
            <p className="eyebrow">From photo</p>
          </div>
          <div className="suggestion-grid">
            {photoSuggestions.map((suggestion) => {
              const isActive = selectedPhotoSuggestion?.species === suggestion.species;

              return (
                <button
                  className={isActive ? "suggestion-card active" : "suggestion-card"}
                  key={`${suggestion.species}-${suggestion.confidence ?? 0}`}
                  onClick={() => {
                    setSelectedPhotoSuggestion(suggestion);
                    setSelectedSpeciesSuggestion(null);
                    setSpeciesQuery(suggestion.species);
                    setSpeciesSource("suggestion");
                    setSpeciesSuggestions([]);
                    lastSearchQueryRef.current = "";
                    setError(null);
                  }}
                  type="button"
                >
                  <strong>{suggestion.species}</strong>
                  <span>
                    {suggestion.confidence
                      ? `${Math.round(suggestion.confidence * 100)}% match`
                      : "Suggested match"}
                  </span>
                  {suggestion.commonNames[0] ? <small>{suggestion.commonNames[0]}</small> : null}
                  {suggestion.description ? (
                    <p className="suggestion-copy">{suggestion.description.slice(0, 120)}...</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <label className="field">
        <span>Plant name</span>
        <input
          onChange={(event) => {
            setSpeciesQuery(event.target.value);
            setSpeciesSource("manual");
            setSelectedSpeciesSuggestion(null);
            setSelectedPhotoSuggestion(null);
            setError(null);
          }}
          placeholder="Start typing: Chinese money plant"
          required
          value={speciesQuery}
        />
        <small>Type at least 3 characters, then select one suggestion before saving.</small>
      </label>

      {speciesSuggestions.length > 0 ? (
        <div className="stack-sm">
          <div className="inline-actions">
            <p className="eyebrow">Suggestions</p>
            {searchPending ? <p className="muted">Searching...</p> : null}
          </div>
          <div className="suggestion-grid">
            {speciesSuggestions.map((suggestion) => {
              const isActive = selectedSpeciesSuggestion?.latinName === suggestion.latinName;

              return (
                <button
                  className={isActive ? "suggestion-card active" : "suggestion-card"}
                  key={suggestion.latinName}
                  onClick={() => {
                    setSelectedSpeciesSuggestion(suggestion);
                    setSelectedPhotoSuggestion(null);
                    setSpeciesQuery(suggestion.commonName ?? suggestion.latinName);
                    setSpeciesSource("suggestion");
                    setError(null);
                  }}
                  type="button"
                >
                  {suggestion.imageUrl ? (
                    <span className="suggestion-media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt={suggestion.latinName} src={suggestion.imageUrl} />
                    </span>
                  ) : null}
                  <strong>{suggestion.latinName}</strong>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {speciesSource === "manual" &&
      speciesQuery.trim().length >= 3 &&
      !searchPending &&
      speciesSuggestions.length === 0 ? (
        <p className="muted">No species suggestions yet. Try a more specific plant name.</p>
      ) : null}

      {getSelectedLatinName() ? (
        <p className="muted">Selected species: {getSelectedLatinName()}</p>
      ) : (
        <p className="muted">Pick a suggestion to lock the species before saving.</p>
      )}

      {error ? <p className="field-error">{error}</p> : null}

      <div className="inline-actions">
        <button className="button button-primary" disabled={!canSavePlant} type="submit">
          {createPending ? "Saving plant..." : "Save plant"}
        </button>
        <p className="muted">If you skip the nickname, we will use the species name automatically.</p>
      </div>
    </form>
  );
}
