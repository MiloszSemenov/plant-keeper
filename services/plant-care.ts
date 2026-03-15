import { PlantSpeciesSource } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/db/client";
import { requireEnv } from "@/lib/env";
import { normalizePlantLookupKey } from "@/lib/plants";
import { ApiError } from "@/lib/http";

const aiCareSchema = z.object({
  scientific_name: z.string().trim().min(2).max(140).optional(),
  watering_interval_days: z.number().int().min(1).max(45),
  fertilizer_interval_days: z.number().int().min(7).max(180).optional().nullable(),
  light_requirement: z.string().trim().min(3).max(120),
  soil_type: z.string().trim().min(3).max(120),
  pet_toxic: z.boolean(),
  care_notes: z.string().trim().min(20).max(2000)
});

type ResolvedPlantCare = {
  scientificName: string;
  wateringIntervalDays: number;
  fertilizerIntervalDays: number | null;
  lightRequirement: string;
  soilType: string;
  petToxic: boolean;
  careNotes: string;
  source: PlantSpeciesSource;
  aliases: string[];
};

function hasCompletePlantCare(species: {
  wateringIntervalDays: number;
  lightRequirement: string | null;
  soilType: string | null;
  petToxic: boolean | null;
  careNotes: string | null;
}) {
  return Boolean(
    species.wateringIntervalDays &&
      species.lightRequirement &&
      species.soilType &&
      species.petToxic !== null &&
      species.careNotes
  );
}

function extractJson(content: string) {
  const fencedMatch = content.match(/```json\s*([\s\S]+?)\s*```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1];
  }

  const objectMatch = content.match(/\{[\s\S]+\}/);
  return objectMatch?.[0] ?? content;
}

function extractStringValues(value: unknown): string[] {
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectAliases(scientificName: string, values: unknown[]) {
  const scientificKey = normalizePlantLookupKey(scientificName);
  const aliases = new Map<string, string>();

  for (const value of values) {
    for (const item of extractStringValues(value)) {
      const normalizedKey = normalizePlantLookupKey(item);

      if (!normalizedKey || normalizedKey === scientificKey || aliases.has(normalizedKey)) {
        continue;
      }

      aliases.set(normalizedKey, item);
    }
  }

  return Array.from(aliases.values());
}

async function findLocalPlantSpecies(speciesName: string) {
  const normalizedLookupKey = normalizePlantLookupKey(speciesName);

  const directMatch = await prisma.plantSpecies.findUnique({
    where: {
      normalizedLookupKey
    }
  });

  if (directMatch) {
    return directMatch;
  }

  const aliasMatch = await prisma.plantSpeciesAlias.findUnique({
    where: {
      normalizedAliasKey: normalizedLookupKey
    },
    include: {
      species: true
    }
  });

  return aliasMatch?.species ?? null;
}

async function storeSpeciesAliases(speciesId: string, scientificName: string, aliases: string[]) {
  const scientificKey = normalizePlantLookupKey(scientificName);
  const aliasRows = aliases
    .map((aliasName) => ({
      aliasName: aliasName.trim(),
      normalizedAliasKey: normalizePlantLookupKey(aliasName)
    }))
    .filter(
      (alias) =>
        alias.aliasName && alias.normalizedAliasKey && alias.normalizedAliasKey !== scientificKey
    );

  if (aliasRows.length === 0) {
    return;
  }

  await prisma.plantSpeciesAlias.createMany({
    data: aliasRows.map((alias) => ({
      speciesId,
      aliasName: alias.aliasName,
      normalizedAliasKey: alias.normalizedAliasKey
    })),
    skipDuplicates: true
  });
}

async function upsertPlantSpecies(care: ResolvedPlantCare) {
  const normalizedLookupKey = normalizePlantLookupKey(care.scientificName);
  const species = await prisma.plantSpecies.upsert({
    where: {
      normalizedLookupKey
    },
    update: {
      scientificName: care.scientificName,
      normalizedLookupKey,
      wateringIntervalDays: care.wateringIntervalDays,
      fertilizerIntervalDays: care.fertilizerIntervalDays,
      lightRequirement: care.lightRequirement,
      soilType: care.soilType,
      petToxic: care.petToxic,
      careNotes: care.careNotes,
      source: care.source
    },
    create: {
      scientificName: care.scientificName,
      normalizedLookupKey,
      wateringIntervalDays: care.wateringIntervalDays,
      fertilizerIntervalDays: care.fertilizerIntervalDays,
      lightRequirement: care.lightRequirement,
      soilType: care.soilType,
      petToxic: care.petToxic,
      careNotes: care.careNotes,
      source: care.source
    }
  });

  await storeSpeciesAliases(species.id, species.scientificName, care.aliases);
  return species;
}

async function generatePlantCare(speciesName: string): Promise<ResolvedPlantCare> {
  const apiUrl = requireEnv("AI_API_URL");
  const apiKey = requireEnv("AI_API_KEY");
  const model = process.env.AI_MODEL ?? "gpt-4o-mini";
  const endpointHost = (() => {
    try {
      return new URL(apiUrl).host;
    } catch {
      return "unknown";
    }
  })();

  console.info("[plant-care][ai] request", {
    speciesName,
    model,
    endpointHost
  });

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: {
        type: "json_object"
      },
      messages: [
        {
          role: "system",
          content:
            "You generate indoor plant care profiles. Return JSON only. Resolve common names to a scientific name when possible. Do not default to 7-day watering unless it is genuinely appropriate for that species."
        },
        {
          role: "user",
          content: `Generate a plant care profile for: ${speciesName}.

Return JSON with fields:
- scientific_name: string
- watering_interval_days: integer
- fertilizer_interval_days: integer or null
- light_requirement: string
- soil_type: string
- pet_toxic: boolean
- care_notes: string

Requirements:
- Use species-specific indoor care guidance.
- Avoid generic defaults.
- watering_interval_days must be a realistic average in whole days.`
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[plant-care][ai] request_failed", {
      speciesName,
      model,
      endpointHost,
      status: response.status
    });
    throw new ApiError(502, `AI plant care generation failed: ${text || response.statusText}`);
  }

  const requestId = response.headers.get("x-request-id");
  const payload = await response.json();

  console.info("[plant-care][ai] response", {
    speciesName,
    model,
    endpointHost,
    requestId,
    usage: payload.usage ?? null
  });

  const rawContent =
    payload.choices?.[0]?.message?.content ??
    payload.output_text ??
    payload.output?.[0]?.content?.[0]?.text;

  if (!rawContent || typeof rawContent !== "string") {
    throw new ApiError(502, "AI plant care generation returned an invalid response");
  }

  const parsed = aiCareSchema.parse(JSON.parse(extractJson(rawContent)));
  const scientificName = parsed.scientific_name?.trim() || speciesName.trim();

  return {
    scientificName,
    wateringIntervalDays: parsed.watering_interval_days,
    fertilizerIntervalDays: parsed.fertilizer_interval_days ?? null,
    lightRequirement: parsed.light_requirement.trim(),
    soilType: parsed.soil_type.trim(),
    petToxic: parsed.pet_toxic,
    careNotes: parsed.care_notes.trim(),
    source: PlantSpeciesSource.ai,
    aliases: collectAliases(scientificName, [speciesName])
  };
}

export async function getOrCreatePlantSpecies(speciesName: string) {
  const normalizedInput = speciesName.trim();

  if (!normalizedInput) {
    throw new ApiError(400, "Plant species is required");
  }

  const existing = await findLocalPlantSpecies(normalizedInput);

  if (existing && hasCompletePlantCare(existing)) {
    console.info("[plant-care] cache_hit", {
      speciesName: existing.scientificName,
      source: existing.source
    });
    return existing;
  }

  const targetSpeciesName = existing?.scientificName ?? normalizedInput;
  const aiCare = await generatePlantCare(targetSpeciesName);

  if (!existing) {
    return upsertPlantSpecies(aiCare);
  }

  console.info("[plant-care] enriching_existing_species", {
    speciesName: existing.scientificName,
    previousSource: existing.source
  });

  return upsertPlantSpecies({
    ...aiCare,
    aliases: collectAliases(aiCare.scientificName, [normalizedInput, ...aiCare.aliases])
  });
}
