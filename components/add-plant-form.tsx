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

type VaultOption = {
  id: string;
  name: string;
};

type Suggestion = {
  species: string;
  confidence?: number;
  accessToken?: string | null;
  commonNames: string[];
  description: string | null;
  url: string | null;
};

type SavedMatch = {
  id: string;
  species: string;
  imageUrl: string | null;
  aliases: string[];
};

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
  const [species, setSpecies] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [imageName, setImageName] = useState<string | null>(null);
  const [photoSuggestions, setPhotoSuggestions] = useState<Suggestion[]>([]);
  const [savedMatches, setSavedMatches] = useState<SavedMatch[]>([]);
  const [knowledgeBaseSuggestions, setKnowledgeBaseSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [identifyPending, startIdentify] = useTransition();
  const [createPending, startCreate] = useTransition();
  const [searchPending, startSearch] = useTransition();
  const lastSearchQueryRef = useRef<string>("");

  useEffect(() => {
    const trimmedQuery = species.trim();

    if (trimmedQuery.length < 3) {
      setSavedMatches([]);
      setKnowledgeBaseSuggestions([]);
      lastSearchQueryRef.current = "";
      return;
    }

    if (trimmedQuery === lastSearchQueryRef.current) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      startSearch(async () => {
        const response = await fetch(`/api/plant/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal
        }).catch(() => null);

        if (!response || controller.signal.aborted) {
          return;
        }

        const payload = await response
          .json()
          .catch(() => ({ suggestions: [], error: "Unable to search plants" }));

        if (!response.ok) {
          if (!controller.signal.aborted) {
            setError(payload.error ?? "Unable to search plants");
          }
          return;
        }

        lastSearchQueryRef.current = trimmedQuery;
        setSavedMatches(payload.savedMatches ?? []);
        setKnowledgeBaseSuggestions(payload.suggestions ?? []);
      });
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [species]);

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setImage(undefined);
      setImageName(null);
      setPhotoSuggestions([]);
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setError(null);
      setImage(dataUrl);
      setImageName(file.name);
      setPhotoSuggestions([]);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Unable to load the image");
      setImage(undefined);
      setImageName(null);
      setPhotoSuggestions([]);
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
      if (payload.suggestions?.[0]?.species) {
        setSpecies(payload.suggestions[0].species);
      }
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startCreate(async () => {
      const response = await fetch("/api/plants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          vaultId,
          nickname: nickname.trim(),
          species,
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

  return (
    <form className="panel stack-md" onSubmit={onSubmit}>
      <div className="stack-xs">
        <p className="eyebrow">Add plant</p>
        <h2>Add a plant to your space</h2>
        <p>
          Drop in a photo for instant suggestions, or type a species name to search Plant Keeper
          first and then the Plant.id knowledge base.
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
            {photoSuggestions.map((suggestion) => (
              <button
                className={
                  suggestion.species === species ? "suggestion-card active" : "suggestion-card"
                }
                key={`${suggestion.species}-${suggestion.confidence ?? 0}`}
                onClick={() => setSpecies(suggestion.species)}
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
            ))}
          </div>
        </div>
      ) : null}

      <label className="field">
        <span>Species</span>
        <input
          onChange={(event) => {
            setSpecies(event.target.value);
            setError(null);
          }}
          placeholder="Start typing: Monstera deliciosa"
          required
          value={species}
        />
        <small>Type at least 3 characters to search by name.</small>
      </label>

      {savedMatches.length > 0 ? (
        <div className="stack-sm">
          <div className="inline-actions">
            <p className="eyebrow">Saved in Plant Keeper</p>
            {searchPending ? <p className="muted">Searching...</p> : null}
          </div>
          <div className="suggestion-grid">
            {savedMatches.map((match) => (
              <button
                className={match.species === species ? "suggestion-card active" : "suggestion-card"}
                key={match.id}
                onClick={() => setSpecies(match.species)}
                type="button"
              >
                {match.imageUrl ? (
                  <span className="suggestion-media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={match.species} src={match.imageUrl} />
                  </span>
                ) : null}
                <strong>{match.species}</strong>
                {match.aliases[0] ? <span>{match.aliases[0]}</span> : <span>Saved species</span>}
                <small>{match.imageUrl ? "Uses an existing plant photo" : "No saved photo yet"}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {species.trim().length >= 3 && !searchPending && savedMatches.length === 0 ? (
        <p className="muted">No saved matches yet. You can still add the species manually.</p>
      ) : null}

      {knowledgeBaseSuggestions.length > 0 ? (
        <div className="stack-sm">
          <div className="inline-actions">
            <p className="eyebrow">Knowledge base</p>
            {searchPending ? <p className="muted">Searching...</p> : null}
          </div>
          <div className="suggestion-grid">
            {knowledgeBaseSuggestions.map((suggestion) => (
              <button
                className={
                  suggestion.species === species ? "suggestion-card active" : "suggestion-card"
                }
                key={`${suggestion.accessToken ?? suggestion.species}-search`}
                onClick={() => setSpecies(suggestion.species)}
                type="button"
              >
                <strong>{suggestion.species}</strong>
                {suggestion.commonNames[0] ? <span>{suggestion.commonNames[0]}</span> : null}
                {suggestion.description ? (
                  <p className="suggestion-copy">{suggestion.description.slice(0, 120)}...</p>
                ) : null}
                {suggestion.url ? (
                  <small>{suggestion.url.replace("https://", "").replace("http://", "")}</small>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="field-error">{error}</p> : null}

      <div className="inline-actions">
        <button className="button button-primary" disabled={createPending} type="submit">
          {createPending ? "Saving plant..." : "Save plant"}
        </button>
        <p className="muted">If you skip the nickname, we will use the species name automatically.</p>
      </div>
    </form>
  );
}
