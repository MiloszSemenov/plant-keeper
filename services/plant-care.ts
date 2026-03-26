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

export type LocalPlantSearchResult = {
  id: string;
  species: string;
  imageUrl: string | null;
  aliases: string[];
};

type WateringProfile = {
  name: string;
  min: number;
  max: number;
  keywords: string[];
};

const SAFE_GLOBAL_WATERING_BOUNDS = {
  min: 2,
  max: 30
} as const;

const WATERING_PROFILES: WateringProfile[] = [
  {
    name: "thirsty herb or moisture-loving plant",
    min: 2,
    max: 5,
    keywords: [
      "basil",
      "mint",
      "parsley",
      "cilantro",
      "coriander",
      "maidenhair fern",
      "fittonia",
      "polka dot plant",
      "hypoestes"
    ]
  },
  {
    name: "moisture-loving tropical",
    min: 3,
    max: 7,
    keywords: [
      "fern",
      "peace lily",
      "spathiphyllum",
      "calathea",
      "maranta",
      "alocasia",
      "anthurium"
    ]
  },
  {
    name: "tropical foliage",
    min: 4,
    max: 8,
    keywords: [
      "monstera",
      "philodendron",
      "pothos",
      "epipremnum",
      "scindapsus",
      "ficus",
      "dracaena",
      "syngonium",
      "aglaonema",
      "dieffenbachia",
      "peperomia",
      "pilea",
      "schefflera",
      "croton"
    ]
  },
  {
    name: "orchid",
    min: 6,
    max: 10,
    keywords: ["orchid", "phalaenopsis", "dendrobium", "oncidium"]
  },
  {
    name: "arid or drought-tolerant plant",
    min: 10,
    max: 21,
    keywords: [
      "succulent",
      "cactus",
      "aloe",
      "agave",
      "echeveria",
      "haworthia",
      "haworthiopsis",
      "sedum",
      "jade",
      "crassula",
      "snake plant",
      "sansevieria",
      "zz plant",
      "zamioculcas",
      "kalanchoe",
      "opuntia"
    ]
  }
];

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

function clampInteger(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveWateringProfile(care: Pick<
  ResolvedPlantCare,
  "scientificName" | "aliases" | "lightRequirement" | "soilType" | "careNotes"
>) {
  const haystack = [
    care.scientificName,
    ...care.aliases,
    care.lightRequirement,
    care.soilType,
    care.careNotes
  ]
    .join(" ")
    .toLowerCase();

  return WATERING_PROFILES.find((profile) =>
    profile.keywords.some((keyword) => haystack.includes(keyword))
  );
}

function normalizeGeneratedPlantCare(care: ResolvedPlantCare) {
  const profile = resolveWateringProfile(care);
  const min = profile?.min ?? SAFE_GLOBAL_WATERING_BOUNDS.min;
  const max = profile?.max ?? SAFE_GLOBAL_WATERING_BOUNDS.max;
  const normalizedWateringIntervalDays = clampInteger(care.wateringIntervalDays, min, max);

  if (normalizedWateringIntervalDays !== care.wateringIntervalDays) {
    console.info("[plant-care] normalized_watering_interval", {
      speciesName: care.scientificName,
      originalWateringIntervalDays: care.wateringIntervalDays,
      normalizedWateringIntervalDays,
      profile: profile?.name ?? "global"
    });
  }

  return {
    ...care,
    wateringIntervalDays: normalizedWateringIntervalDays
  };
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

function getSearchPriority(
  species: {
    scientificName: string;
    normalizedLookupKey: string;
    aliases: Array<{
      aliasName: string;
      normalizedAliasKey: string;
    }>;
  },
  normalizedQuery: string
) {
  const scientificNameKey = species.normalizedLookupKey;
  const aliasKeys = species.aliases.map((alias) => alias.normalizedAliasKey);

  if (scientificNameKey === normalizedQuery) {
    return 5;
  }

  if (aliasKeys.includes(normalizedQuery)) {
    return 4;
  }

  if (scientificNameKey.startsWith(normalizedQuery)) {
    return 3;
  }

  if (aliasKeys.some((aliasKey) => aliasKey.startsWith(normalizedQuery))) {
    return 2;
  }

  if (
    scientificNameKey.includes(normalizedQuery) ||
    aliasKeys.some((aliasKey) => aliasKey.includes(normalizedQuery))
  ) {
    return 1;
  }

  return 0;
}

export async function searchLocalPlantSpecies(query: string): Promise<LocalPlantSearchResult[]> {
  const trimmedQuery = query.trim();
  const normalizedQuery = normalizePlantLookupKey(trimmedQuery);

  if (!normalizedQuery) {
    return [];
  }

  const speciesMatches = await prisma.plantSpecies.findMany({
    where: {
      OR: [
        {
          normalizedLookupKey: {
            contains: normalizedQuery
          }
        },
        {
          scientificName: {
            contains: trimmedQuery,
            mode: "insensitive"
          }
        },
        {
          aliases: {
            some: {
              normalizedAliasKey: {
                contains: normalizedQuery
              }
            }
          }
        },
        {
          aliases: {
            some: {
              aliasName: {
                contains: trimmedQuery,
                mode: "insensitive"
              }
            }
          }
        }
      ]
    },
    include: {
      aliases: {
        select: {
          aliasName: true,
          normalizedAliasKey: true
        }
      },
      plants: {
        where: {
          imageUrl: {
            not: null
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        select: {
          imageUrl: true
        },
        take: 1
      }
    },
    take: 24
  });

  return speciesMatches
    .map((species) => ({
      id: species.id,
      species: species.scientificName,
      imageUrl: species.plants[0]?.imageUrl ?? null,
      aliases: species.aliases.map((alias) => alias.aliasName),
      priority: getSearchPriority(species, normalizedQuery)
    }))
    .filter((species) => species.priority > 0)
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }

      if (left.species.length !== right.species.length) {
        return left.species.length - right.species.length;
      }

      return left.species.localeCompare(right.species);
    })
    .slice(0, 3)
    .map(({ priority: _priority, ...species }) => species);
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
            "You generate indoor plant care profiles for houseplants. Return JSON only. Resolve common names to a scientific name when possible. Choose watering_interval_days as a realistic indoor average for a typical potted plant. Use shorter intervals for thirsty herbs, ferns, and moisture-loving tropical plants, and use longer intervals only for drought-tolerant plants such as succulents, cacti, snake plants, and ZZ plants. Do not use generic weekly defaults."
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
- watering_interval_days must be a realistic average in whole days.
- If the plant is tropical foliage, prefer roughly 4-8 days unless the species is notably thirstier.
- If the plant is a succulent, cactus, snake plant, or ZZ plant, use a meaningfully longer interval.
- If the plant is an herb or very thirsty fern, use a meaningfully shorter interval.`
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

  return normalizeGeneratedPlantCare({
    scientificName,
    wateringIntervalDays: parsed.watering_interval_days,
    fertilizerIntervalDays: parsed.fertilizer_interval_days ?? null,
    lightRequirement: parsed.light_requirement.trim(),
    soilType: parsed.soil_type.trim(),
    petToxic: parsed.pet_toxic,
    careNotes: parsed.care_notes.trim(),
    source: PlantSpeciesSource.ai,
    aliases: collectAliases(scientificName, [speciesName])
  });
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
