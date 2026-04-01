import { ApiError } from "@/lib/http";
import { normalizeBase64Image } from "@/lib/base64";
import { requireEnv } from "@/lib/env";
import { resolvePlantImage } from "@/lib/plant-image";

type PlantSuggestion = {
  species: string;
  confidence?: number;
  accessToken?: string | null;
  commonNames: string[];
  description: string | null;
  url: string | null;
  imageUrl: string | null;
};

const IDENTIFICATION_DETAILS = "common_names,url,description,taxonomy,wiki_image,scientific_name";
const KB_DETAILS = "common_names,description,url,wiki_image,scientific_name";

function extractStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractImageUrl(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  return (
    extractStringValue(record.value) ??
    extractStringValue(record.url) ??
    (Array.isArray(record.images) ? extractImageUrl(record.images[0]) : null) ??
    (Array.isArray(record.similar_images) ? extractImageUrl(record.similar_images[0]) : null) ??
    null
  );
}

function extractDescription(details: Record<string, unknown> | undefined) {
  const description = details?.description;

  if (!description) {
    return null;
  }

  if (typeof description === "string") {
    return description;
  }

  if (typeof description === "object" && description && "value" in description) {
    const value = description.value;
    return typeof value === "string" ? value : null;
  }

  return null;
}

function mapSuggestion(suggestion: Record<string, unknown>): PlantSuggestion {
  const details =
    typeof suggestion.details === "object" && suggestion.details
      ? (suggestion.details as Record<string, unknown>)
      : undefined;

  const commonNames = Array.isArray(details?.common_names)
    ? details.common_names.filter((name): name is string => typeof name === "string")
    : [];

  return {
    species:
      String(
        suggestion.name ??
          suggestion.plant_name ??
          (suggestion.species as { scientificNameWithoutAuthor?: string } | undefined)
            ?.scientificNameWithoutAuthor ??
          ""
      ).trim(),
    confidence:
      suggestion.probability === undefined ? undefined : Number(suggestion.probability ?? 0),
    accessToken:
      typeof suggestion.access_token === "string" ? suggestion.access_token : null,
    commonNames,
    description: extractDescription(details),
    url:
      extractStringValue(details?.url) ??
      extractStringValue(suggestion.url) ??
      extractStringValue((suggestion as { details?: { url?: string } }).details?.url),
    imageUrl: resolvePlantImage({
      context: "identify",
      speciesDefaultImageUrl: null,
      wikipediaImageUrl:
        extractImageUrl(details?.wiki_image) ??
        extractImageUrl((suggestion as { wiki_image?: unknown }).wiki_image) ??
        extractImageUrl((suggestion as { image?: unknown }).image) ??
        extractImageUrl((suggestion as { image_url?: unknown }).image_url) ??
        extractImageUrl((suggestion as { similar_images?: unknown }).similar_images) ??
        null
    })
  };
}

export async function identifyPlantFromImage(image: string): Promise<PlantSuggestion[]> {
  const apiKey = requireEnv("PLANT_ID_API_KEY");
  const { content } = normalizeBase64Image(image);
  const endpoint = new URL("https://api.plant.id/v3/identification");

  endpoint.searchParams.set("details", IDENTIFICATION_DETAILS);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey
    },
    body: JSON.stringify({
      images: [content],
      similar_images: true
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(502, `Plant identification failed: ${text || response.statusText}`);
  }

  const payload = await response.json();
  const suggestions = payload.suggestions ?? payload.result?.classification?.suggestions ?? [];

  return suggestions
    .map((suggestion: Record<string, unknown>) => mapSuggestion(suggestion))
    .filter((suggestion: PlantSuggestion) => suggestion.species.length > 0)
    .sort(
      (left: PlantSuggestion, right: PlantSuggestion) =>
        (right.confidence ?? 0) - (left.confidence ?? 0)
    )
    .slice(0, 3);
}

async function getPlantDetails(accessToken: string) {
  const apiKey = requireEnv("PLANT_ID_API_KEY");
  const endpoint = new URL(`https://plant.id/api/v3/kb/plants/${accessToken}`);

  endpoint.searchParams.set("details", KB_DETAILS);

  const response = await fetch(endpoint, {
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(502, `Plant details failed: ${text || response.statusText}`);
  }

  const payload = await response.json();

  return {
    commonNames: Array.isArray(payload.common_names)
      ? payload.common_names.filter((item: unknown): item is string => typeof item === "string")
      : [],
    description:
      typeof payload.description === "string"
        ? payload.description
        : typeof payload.description?.value === "string"
          ? payload.description.value
          : null,
    url: extractStringValue(payload.url),
    imageUrl: resolvePlantImage({
      context: "identify",
      speciesDefaultImageUrl: null,
      wikipediaImageUrl:
        extractImageUrl(payload.wiki_image) ??
        extractImageUrl(payload.image) ??
        extractImageUrl(payload.image_url) ??
        null
    }),
    scientificName:
      extractStringValue(payload.scientific_name) ??
      extractStringValue(payload.name) ??
      null
  };
}

export async function searchPlantsByName(query: string): Promise<PlantSuggestion[]> {
  const apiKey = requireEnv("PLANT_ID_API_KEY");
  const endpoint = new URL("https://plant.id/api/v3/kb/plants/name_search");

  endpoint.searchParams.set("q", query.trim());

  const response = await fetch(endpoint, {
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(502, `Plant search failed: ${text || response.statusText}`);
  }

  const payload = await response.json();
  const baseSuggestions = Array.isArray(payload)
    ? payload
        .filter(
          (item): item is { access_token?: string; name?: string } =>
            typeof item === "object" && item !== null
        )
        .slice(0, 6)
    : [];

  const detailedSuggestions = await Promise.all(
    baseSuggestions.map(async (suggestion) => {
      const accessToken = suggestion.access_token ?? null;

      if (!accessToken || !suggestion.name) {
        return {
          species: suggestion.name?.trim() ?? "",
          accessToken,
          commonNames: [],
          description: null,
          url: null,
          imageUrl: resolvePlantImage({
            context: "identify",
            speciesDefaultImageUrl: null,
            wikipediaImageUrl:
              extractImageUrl((suggestion as { wiki_image?: unknown }).wiki_image) ??
              extractImageUrl((suggestion as { image?: unknown }).image) ??
              extractImageUrl((suggestion as { image_url?: unknown }).image_url) ??
              null
          })
        } satisfies PlantSuggestion;
      }

      try {
        const details = await getPlantDetails(accessToken);

        return {
          species: details.scientificName ?? suggestion.name.trim(),
          accessToken,
          commonNames: details.commonNames,
          description: details.description,
          url: details.url,
          imageUrl: resolvePlantImage({
            context: "identify",
            speciesDefaultImageUrl: details.imageUrl,
            wikipediaImageUrl:
              extractImageUrl((suggestion as { wiki_image?: unknown }).wiki_image) ??
              extractImageUrl((suggestion as { image?: unknown }).image) ??
              extractImageUrl((suggestion as { image_url?: unknown }).image_url) ??
              null
          })
        } satisfies PlantSuggestion;
      } catch {
        return {
          species: suggestion.name.trim(),
          accessToken,
          commonNames: [],
          description: null,
          url: null,
          imageUrl: resolvePlantImage({
            context: "identify",
            speciesDefaultImageUrl: null,
            wikipediaImageUrl:
              extractImageUrl((suggestion as { wiki_image?: unknown }).wiki_image) ??
              extractImageUrl((suggestion as { image?: unknown }).image) ??
              extractImageUrl((suggestion as { image_url?: unknown }).image_url) ??
              null
          })
        } satisfies PlantSuggestion;
      }
    })
  );

  return detailedSuggestions.filter((suggestion) => suggestion.species.length > 0);
}
