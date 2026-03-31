import { PlantSpeciesSource } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { requireEnv } from '@/lib/env';
import { normalizePlantLookupKey } from '@/lib/plants';
import { ApiError } from '@/lib/http';
import { searchPlantsByName } from '@/services/plant-id';
import { saveRemotePlantImage } from '@/services/storage';

const aiCareSchema = z.object({
  scientific_name: z.string().trim().min(2).max(140).optional(),
  watering_interval_days: z.number().int().min(1).max(45),
  fertilizer_interval_days: z
    .number()
    .int()
    .min(7)
    .max(180)
    .optional()
    .nullable(),
  light_requirement: z.string().trim().min(3).max(120),
  soil_type: z.string().trim().min(3).max(120),
  pet_toxic: z.boolean(),
  care_notes: z.string().trim().min(20).max(2000),
});

const aiSuggestionSchema = z.object({
  suggestions: z
    .array(
      z.union([
        z.string().trim().min(2).max(140),
        z.object({
          latin_name: z.string().trim().min(2).max(140).optional(),
          scientific_name: z.string().trim().min(2).max(140).optional(),
        }),
      ]),
    )
    .min(1)
    .max(3),
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

export type PlantSpeciesSuggestion = {
  latinName: string;
  imageUrl: string | null;
  source: 'database' | 'alias' | 'plant_id' | 'ai';
};

type WikipediaImageResult = {
  imageUrl: string | null;
};

type WateringProfile = {
  name: string;
  min: number;
  max: number;
  keywords: string[];
};

const SAFE_GLOBAL_WATERING_BOUNDS = {
  min: 2,
  max: 30,
} as const;

const WATERING_PROFILES: WateringProfile[] = [
  {
    name: 'thirsty herb or moisture-loving plant',
    min: 2,
    max: 5,
    keywords: [
      'basil',
      'mint',
      'parsley',
      'cilantro',
      'coriander',
      'maidenhair fern',
      'fittonia',
      'polka dot plant',
      'hypoestes',
    ],
  },
  {
    name: 'moisture-loving tropical',
    min: 3,
    max: 7,
    keywords: [
      'fern',
      'peace lily',
      'spathiphyllum',
      'calathea',
      'maranta',
      'alocasia',
      'anthurium',
    ],
  },
  {
    name: 'tropical foliage',
    min: 4,
    max: 8,
    keywords: [
      'monstera',
      'philodendron',
      'pothos',
      'epipremnum',
      'scindapsus',
      'ficus',
      'dracaena',
      'syngonium',
      'aglaonema',
      'dieffenbachia',
      'peperomia',
      'pilea',
      'schefflera',
      'croton',
    ],
  },
  {
    name: 'orchid',
    min: 6,
    max: 10,
    keywords: ['orchid', 'phalaenopsis', 'dendrobium', 'oncidium'],
  },
  {
    name: 'arid or drought-tolerant plant',
    min: 10,
    max: 21,
    keywords: [
      'succulent',
      'cactus',
      'aloe',
      'agave',
      'echeveria',
      'haworthia',
      'haworthiopsis',
      'sedum',
      'jade',
      'crassula',
      'snake plant',
      'sansevieria',
      'zz plant',
      'zamioculcas',
      'kalanchoe',
      'opuntia',
    ],
  },
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
    species.careNotes,
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
  if (typeof value === 'string') {
    return value.trim() ? [value.trim()] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectAliases(scientificName: string, values: unknown[]) {
  const scientificKey = normalizePlantLookupKey(scientificName);
  const aliases = new Map<string, string>();

  for (const value of values) {
    for (const item of extractStringValues(value)) {
      const normalizedKey = normalizePlantLookupKey(item);

      if (
        !normalizedKey ||
        normalizedKey === scientificKey ||
        aliases.has(normalizedKey)
      ) {
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

function resolveWateringProfile(
  care: Pick<
    ResolvedPlantCare,
    'scientificName' | 'aliases' | 'lightRequirement' | 'soilType' | 'careNotes'
  >,
) {
  const haystack = [
    care.scientificName,
    ...care.aliases,
    care.lightRequirement,
    care.soilType,
    care.careNotes,
  ]
    .join(' ')
    .toLowerCase();

  return WATERING_PROFILES.find((profile) =>
    profile.keywords.some((keyword) => haystack.includes(keyword)),
  );
}

function normalizeGeneratedPlantCare(care: ResolvedPlantCare) {
  const profile = resolveWateringProfile(care);
  const min = profile?.min ?? SAFE_GLOBAL_WATERING_BOUNDS.min;
  const max = profile?.max ?? SAFE_GLOBAL_WATERING_BOUNDS.max;
  const normalizedWateringIntervalDays = clampInteger(
    care.wateringIntervalDays,
    min,
    max,
  );

  if (normalizedWateringIntervalDays !== care.wateringIntervalDays) {
    console.info('[plant-care] normalized_watering_interval', {
      speciesName: care.scientificName,
      originalWateringIntervalDays: care.wateringIntervalDays,
      normalizedWateringIntervalDays,
      profile: profile?.name ?? 'global',
    });
  }

  return {
    ...care,
    wateringIntervalDays: normalizedWateringIntervalDays,
  };
}

function getSpeciesImageUrl(species: {
  defaultImageUrl?: string | null;
  plants?: Array<{
    imageUrl: string | null;
  }>;
}) {
  return species.defaultImageUrl ?? species.plants?.[0]?.imageUrl ?? null;
}

async function findLocalPlantSpecies(speciesName: string) {
  const normalizedLookupKey = normalizePlantLookupKey(speciesName);

  const directMatch = await prisma.plantSpecies.findUnique({
    where: {
      normalizedLookupKey,
    },
    select: {
      id: true,
      scientificName: true,
      normalizedLookupKey: true,
      defaultImageUrl: true,
      wateringIntervalDays: true,
      fertilizerIntervalDays: true,
      lightRequirement: true,
      soilType: true,
      petToxic: true,
      careNotes: true,
      source: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (directMatch) {
    return directMatch;
  }

  const aliasMatch = await prisma.plantSpeciesAlias.findFirst({
    where: {
      normalizedAliasKey: normalizedLookupKey,
    },
    select: {
      species: {
        select: {
          id: true,
          scientificName: true,
          normalizedLookupKey: true,
          defaultImageUrl: true,
          wateringIntervalDays: true,
          fertilizerIntervalDays: true,
          lightRequirement: true,
          soilType: true,
          petToxic: true,
          careNotes: true,
          source: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return aliasMatch?.species ?? null;
}

function getScientificSearchPriority(
  species: {
    scientificName: string;
    normalizedLookupKey: string;
  },
  normalizedQuery: string,
) {
  if (species.normalizedLookupKey === normalizedQuery) {
    return 4;
  }

  if (species.normalizedLookupKey.startsWith(normalizedQuery)) {
    return 3;
  }

  if (species.normalizedLookupKey.includes(normalizedQuery)) {
    return 2;
  }

  return 0;
}

function getAliasSearchPriority(
  species: {
    aliases: Array<{
      normalizedAliasKey: string;
    }>;
  },
  normalizedQuery: string,
) {
  const aliasKeys = species.aliases.map((alias) => alias.normalizedAliasKey);

  if (aliasKeys.includes(normalizedQuery)) {
    return 4;
  }

  if (aliasKeys.some((aliasKey) => aliasKey.startsWith(normalizedQuery))) {
    return 3;
  }

  if (aliasKeys.some((aliasKey) => aliasKey.includes(normalizedQuery))) {
    return 2;
  }

  return 0;
}

function sortSearchResults<
  T extends {
    scientificName: string;
    priority: number;
  },
>(results: T[]) {
  return results.sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    if (left.scientificName.length !== right.scientificName.length) {
      return left.scientificName.length - right.scientificName.length;
    }

    return left.scientificName.localeCompare(right.scientificName);
  });
}

function mapLocalSearchResult(species: {
  id: string;
  scientificName: string;
  defaultImageUrl: string | null;
  aliases: Array<{
    aliasName: string;
  }>;
  plants: Array<{
    imageUrl: string | null;
  }>;
}): LocalPlantSearchResult {
  return {
    id: species.id,
    species: species.scientificName,
    imageUrl: getSpeciesImageUrl(species),
    aliases: species.aliases.map((alias) => alias.aliasName),
  };
}

async function searchScientificPlantSpecies(
  query: string,
): Promise<LocalPlantSearchResult[]> {
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
            contains: normalizedQuery,
          },
        },
        {
          scientificName: {
            contains: trimmedQuery,
            mode: 'insensitive',
          },
        },
      ],
    },
    select: {
      id: true,
      scientificName: true,
      normalizedLookupKey: true,
      defaultImageUrl: true,
      aliases: {
        select: {
          aliasName: true,
          normalizedAliasKey: true,
        },
      },
      plants: {
        where: {
          imageUrl: {
            not: null,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          imageUrl: true,
        },
        take: 1,
      },
    },
    take: 24,
  });

  return sortSearchResults(
    speciesMatches
      .map((species) => ({
        ...species,
        priority: getScientificSearchPriority(species, normalizedQuery),
      }))
      .filter((species) => species.priority > 0),
  )
    .slice(0, 3)
    .map((species) => mapLocalSearchResult(species));
}

async function searchAliasPlantSpecies(
  query: string,
): Promise<LocalPlantSearchResult[]> {
  const trimmedQuery = query.trim();
  const normalizedQuery = normalizePlantLookupKey(trimmedQuery);

  if (!normalizedQuery) {
    return [];
  }

  const speciesMatches = await prisma.plantSpecies.findMany({
    where: {
      OR: [
        {
          aliases: {
            some: {
              normalizedAliasKey: {
                contains: normalizedQuery,
              },
            },
          },
        },
        {
          aliases: {
            some: {
              aliasName: {
                contains: trimmedQuery,
                mode: 'insensitive',
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      scientificName: true,
      normalizedLookupKey: true,
      defaultImageUrl: true,
      aliases: {
        select: {
          aliasName: true,
          normalizedAliasKey: true,
        },
      },
      plants: {
        where: {
          imageUrl: {
            not: null,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          imageUrl: true,
        },
        take: 1,
      },
    },
    take: 24,
  });

  return sortSearchResults(
    speciesMatches
      .map((species) => ({
        ...species,
        priority: getAliasSearchPriority(species, normalizedQuery),
      }))
      .filter((species) => species.priority > 0),
  )
    .slice(0, 3)
    .map((species) => mapLocalSearchResult(species));
}

export async function searchLocalPlantSpecies(
  query: string,
): Promise<LocalPlantSearchResult[]> {
  const [scientificMatches, aliasMatches] = await Promise.all([
    searchScientificPlantSpecies(query),
    searchAliasPlantSpecies(query),
  ]);
  const seenSpeciesIds = new Set(scientificMatches.map((match) => match.id));

  return [
    ...scientificMatches,
    ...aliasMatches.filter((match) => !seenSpeciesIds.has(match.id)),
  ].slice(0, 3);
}

async function storeSpeciesAliases(
  speciesId: string,
  scientificName: string,
  aliases: string[],
) {
  const scientificKey = normalizePlantLookupKey(scientificName);
  const aliasRows = aliases
    .map((aliasName) => ({
      aliasName: aliasName.trim(),
      normalizedAliasKey: normalizePlantLookupKey(aliasName),
    }))
    .filter(
      (alias) =>
        alias.aliasName &&
        alias.normalizedAliasKey &&
        alias.normalizedAliasKey !== scientificKey,
    );

  if (aliasRows.length === 0) {
    return;
  }

  await prisma.plantSpeciesAlias.createMany({
    data: aliasRows.map((alias) => ({
      speciesId,
      aliasName: alias.aliasName,
      normalizedAliasKey: alias.normalizedAliasKey,
    })),
    skipDuplicates: true,
  });
}

async function upsertPlantSpecies(care: ResolvedPlantCare) {
  const normalizedLookupKey = normalizePlantLookupKey(care.scientificName);
  const species = await prisma.plantSpecies.upsert({
    where: {
      normalizedLookupKey,
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
      source: care.source,
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
      source: care.source,
    },
    select: {
      id: true,
      scientificName: true,
      normalizedLookupKey: true,
      defaultImageUrl: true,
      wateringIntervalDays: true,
      fertilizerIntervalDays: true,
      lightRequirement: true,
      soilType: true,
      petToxic: true,
      careNotes: true,
      source: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await storeSpeciesAliases(species.id, species.scientificName, care.aliases);
  return species;
}

function getAiClientConfig() {
  const apiUrl = requireEnv('AI_API_URL');
  const apiKey = requireEnv('AI_API_KEY');
  const model = process.env.AI_MODEL ?? 'gpt-4o-mini';
  const endpointHost = (() => {
    try {
      return new URL(apiUrl).host;
    } catch {
      return 'unknown';
    }
  })();

  return {
    apiUrl,
    apiKey,
    model,
    endpointHost,
  };
}

async function requestAiJson({
  label,
  messages,
}: {
  label: string;
  messages: Array<{
    role: 'system' | 'user';
    content: string;
  }>;
}) {
  const { apiUrl, apiKey, model, endpointHost } = getAiClientConfig();

  console.info('[plant-care][ai] request', {
    label,
    model,
    endpointHost,
  });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: {
        type: 'json_object',
      },
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[plant-care][ai] request_failed', {
      label,
      model,
      endpointHost,
      status: response.status,
    });
    throw new ApiError(
      502,
      `AI plant care generation failed: ${text || response.statusText}`,
    );
  }

  const requestId = response.headers.get('x-request-id');
  const payload = await response.json();

  console.info('[plant-care][ai] response', {
    label,
    model,
    endpointHost,
    requestId,
    usage: payload.usage ?? null,
  });

  const rawContent =
    payload.choices?.[0]?.message?.content ??
    payload.output_text ??
    payload.output?.[0]?.content?.[0]?.text;

  if (!rawContent || typeof rawContent !== 'string') {
    throw new ApiError(
      502,
      'AI plant care generation returned an invalid response',
    );
  }

  return rawContent;
}

function normalizeAiSuggestionName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

async function generatePlantCare(
  speciesName: string,
  source: PlantSpeciesSource = PlantSpeciesSource.ai,
): Promise<ResolvedPlantCare> {
  const rawContent = await requestAiJson({
    label: speciesName,
    messages: [
      {
        role: 'system',
        content:
          'You generate indoor plant care profiles for houseplants. Return JSON only. Resolve common names to a scientific name when possible. Choose watering_interval_days as a realistic indoor average for a typical potted plant. Use shorter intervals for thirsty herbs, ferns, and moisture-loving tropical plants, and use longer intervals only for drought-tolerant plants such as succulents, cacti, snake plants, and ZZ plants. Do not use generic weekly defaults.',
      },
      {
        role: 'user',
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
- If the plant is an herb or very thirsty fern, use a meaningfully shorter interval.`,
      },
    ],
  });

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
    source,
    aliases: collectAliases(scientificName, [speciesName]),
  });
}

async function generatePlantNameSuggestions(query: string) {
  const rawContent = await requestAiJson({
    label: `suggest:${query}`,
    messages: [
      {
        role: 'system',
        content:
          'You resolve indoor plant search queries to specific scientific names. Return JSON only.',
      },
      {
        role: 'user',
        content: `Resolve this houseplant search query to up to 3 specific indoor plant scientific names: ${query}.

Return JSON with this shape:
{
  "suggestions": [
    "Scientific name 1",
    "Scientific name 2",
    "Scientific name 3"
  ]
}

Rules:
- Return only valid Latin scientific names.
- If the query is already a scientific name, return that exact scientific name first.
- If the query is a common or generic name like "cactus", "fern", or "plant", return 3 specific popular indoor species.
- Do not return generic category names.
- Do not include explanations.`,
      },
    ],
  });

  const parsedRaw = JSON.parse(extractJson(rawContent));

  const parsed = aiSuggestionSchema.parse({
    suggestions: Array.isArray(parsedRaw.suggestions)
      ? parsedRaw.suggestions.slice(0, 3)
      : [],
  });
  const suggestions = parsed.suggestions
    .map((item) =>
      typeof item === 'string'
        ? normalizeAiSuggestionName(item)
        : normalizeAiSuggestionName(
            item.latin_name ?? item.scientific_name ?? '',
          ),
    )
    .filter(Boolean);

  return Array.from(
    new Map(
      suggestions.map((item) => [normalizePlantLookupKey(item), item]),
    ).values(),
  ).slice(0, 3);
}

async function findWikipediaImage(
  latinName: string,
): Promise<WikipediaImageResult> {
  const endpoint = new URL(
    'https://en.wikipedia.org/w/rest.php/v1/search/page',
  );
  endpoint.searchParams.set('q', latinName);
  endpoint.searchParams.set('limit', '5');

  try {
    const response = await fetch(endpoint);

    if (!response.ok) {
      return {
        imageUrl: null,
      };
    }

    const payload = (await response.json()) as {
      pages?: Array<{
        title?: string;
        key?: string;
        thumbnail?: {
          url?: string;
        };
      }>;
    };
    const normalizedQuery = normalizePlantLookupKey(latinName);
    const pages = Array.isArray(payload.pages) ? payload.pages : [];
    const page =
      pages.find(
        (candidate) =>
          normalizePlantLookupKey(candidate.title ?? '') === normalizedQuery,
      ) ??
      pages.find((candidate) =>
        normalizePlantLookupKey(candidate.title ?? '').includes(
          normalizedQuery,
        ),
      ) ??
      pages[0];

    if (!page) {
      return {
        imageUrl: null,
      };
    }

    return {
      imageUrl: page.thumbnail?.url ?? null,
    };
  } catch {
    return {
      imageUrl: null,
    };
  }
}

async function ensureSpeciesDefaultImage(
  speciesId: string,
  imageUrl: string | null,
) {
  if (!imageUrl) {
    return null;
  }

  try {
    const storedImageUrl = await saveRemotePlantImage(imageUrl);

    await prisma.plantSpecies.update({
      where: {
        id: speciesId,
      },
      data: {
        defaultImageUrl: storedImageUrl,
      },
    });

    return storedImageUrl;
  } catch (error) {
    console.error('[plant-care] default_image_upload_failed', {
      speciesId,
      imageUrl,
      error: error instanceof Error ? error.message : 'unknown_error',
    });

    return null;
  }
}

async function ensureSuggestedPlantSpecies({
  latinName,
  imageUrl,
  source,
}: {
  latinName: string;
  imageUrl: string | null;
  source: PlantSpeciesSource;
}) {
  const species = await getOrCreatePlantSpecies(latinName, {
    source,
  });

  if (species.defaultImageUrl) {
    return species;
  }

  const storedImageUrl = await ensureSpeciesDefaultImage(species.id, imageUrl);

  if (!storedImageUrl) {
    return species;
  }

  return {
    ...species,
    defaultImageUrl: storedImageUrl,
  };
}

export async function getOrCreatePlantSpecies(
  speciesName: string,
  options?: {
    source?: PlantSpeciesSource;
  },
) {
  const normalizedInput = speciesName.trim();

  if (!normalizedInput) {
    throw new ApiError(400, 'Plant species is required');
  }

  const existing = await findLocalPlantSpecies(normalizedInput);

  if (existing && hasCompletePlantCare(existing)) {
    console.info('[plant-care] cache_hit', {
      speciesName: existing.scientificName,
      source: existing.source,
    });
    return existing;
  }

  const targetSpeciesName = existing?.scientificName ?? normalizedInput;
  const aiCare = await generatePlantCare(targetSpeciesName, options?.source);

  if (!existing) {
    return upsertPlantSpecies(aiCare);
  }

  console.info('[plant-care] enriching_existing_species', {
    speciesName: existing.scientificName,
    previousSource: existing.source,
  });

  return upsertPlantSpecies({
    ...aiCare,
    aliases: collectAliases(aiCare.scientificName, [
      normalizedInput,
      ...aiCare.aliases,
    ]),
  });
}

async function findScientificPlantSpecies(latinName: string) {
  const normalizedLookupKey = normalizePlantLookupKey(latinName);

  if (!normalizedLookupKey) {
    return null;
  }

  return prisma.plantSpecies.findUnique({
    where: {
      normalizedLookupKey,
    },
    select: {
      id: true,
      scientificName: true,
      normalizedLookupKey: true,
      defaultImageUrl: true,
      wateringIntervalDays: true,
      fertilizerIntervalDays: true,
      lightRequirement: true,
      soilType: true,
      petToxic: true,
      careNotes: true,
      source: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function hydrateExternalSuggestion({
  latinName,
  imageUrl,
  source,
}: {
  latinName: string;
  imageUrl: string | null;
  source: 'plant_id' | 'ai';
}): Promise<PlantSpeciesSuggestion | null> {
  const normalizedLatinName = latinName.trim();

  if (!normalizedLatinName) {
    return null;
  }

  const wikipediaImage = imageUrl
    ? null
    : await findWikipediaImage(normalizedLatinName);
  const candidateImageUrl = imageUrl ?? wikipediaImage?.imageUrl ?? null;
  const existing = await findScientificPlantSpecies(normalizedLatinName);

  if (existing) {
    if (!existing.defaultImageUrl && candidateImageUrl) {
      const storedImageUrl = await ensureSpeciesDefaultImage(
        existing.id,
        candidateImageUrl,
      );

      if (storedImageUrl) {
        return {
          latinName: existing.scientificName,
          imageUrl: storedImageUrl,
          source,
        };
      }
    }

    return {
      latinName: existing.scientificName,
      imageUrl: existing.defaultImageUrl,
      source,
    };
  }

  if (!candidateImageUrl) {
    return {
      latinName: normalizedLatinName,
      imageUrl: null,
      source,
    };
  }

  const species = await ensureSuggestedPlantSpecies({
    latinName: normalizedLatinName,
    imageUrl: candidateImageUrl,
    source:
      source === 'plant_id'
        ? PlantSpeciesSource.plant_id
        : PlantSpeciesSource.ai,
  });

  return {
    latinName: species.scientificName,
    imageUrl: species.defaultImageUrl,
    source,
  };
}

function dedupeSuggestions(suggestions: PlantSpeciesSuggestion[]) {
  return Array.from(
    new Map(
      suggestions.map((suggestion) => [
        normalizePlantLookupKey(suggestion.latinName),
        suggestion,
      ]),
    ).values(),
  ).slice(0, 3);
}

export async function suggestPlantSpecies(
  query: string,
): Promise<PlantSpeciesSuggestion[]> {
  const results: PlantSpeciesSuggestion[] = [];
  const getUniqueResults = () => dedupeSuggestions(results);
  const hasEnoughResults = () => getUniqueResults().length >= 3;
  const getRemainingSlots = () => 3 - getUniqueResults().length;
  const pushResults = (suggestions: PlantSpeciesSuggestion[]) => {
    results.push(...suggestions);
  };
  const getSeenLatinNames = () =>
    new Set(
      getUniqueResults().map((suggestion) =>
        normalizePlantLookupKey(suggestion.latinName),
      ),
    );

  const scientificMatches = await searchScientificPlantSpecies(query);

  pushResults(
    scientificMatches.map((match) => ({
      latinName: match.species,
      imageUrl: match.imageUrl,
      source: 'database',
    })),
  );

  if (!hasEnoughResults()) {
    const aliasMatches = await searchAliasPlantSpecies(query);
    const seenLatinNames = getSeenLatinNames();

    pushResults(
      aliasMatches
        .filter(
          (match) =>
            !seenLatinNames.has(normalizePlantLookupKey(match.species)),
        )
        .map((match) => ({
          latinName: match.species,
          imageUrl: match.imageUrl,
          source: 'alias',
        })),
    );
  }

  if (!hasEnoughResults()) {
    const plantIdMatches = await searchPlantsByName(query).catch((error) => {
      console.error('[plant-care] plant_id_search_failed', {
        query,
        error: error instanceof Error ? error.message : 'unknown_error',
      });

      return [];
    });
    const seenLatinNames = getSeenLatinNames();
    const matchesToHydrate = plantIdMatches
      .filter((match) => {
        const normalizedLatinName = normalizePlantLookupKey(match.species);

        if (!normalizedLatinName || seenLatinNames.has(normalizedLatinName)) {
          return false;
        }

        seenLatinNames.add(normalizedLatinName);
        return true;
      })
      .slice(0, getRemainingSlots());

    const suggestions = await Promise.all(
      matchesToHydrate.map((match) =>
        hydrateExternalSuggestion({
          latinName: match.species,
          imageUrl: match.imageUrl,
          source: 'plant_id',
        }),
      ),
    );

    pushResults(
      suggestions.filter((suggestion): suggestion is PlantSpeciesSuggestion =>
        Boolean(suggestion),
      ),
    );
  }

  if (!hasEnoughResults()) {
    const aiSuggestions = await generatePlantNameSuggestions(query).catch(
      (error) => {
        console.error('[plant-care] ai_suggestion_failed', {
          query,
          error: error instanceof Error ? error.message : 'unknown_error',
        });

        return [];
      },
    );
    const seenLatinNames = getSeenLatinNames();
    const suggestionsToHydrate = aiSuggestions
      .filter((latinName) => {
        const normalizedLatinName = normalizePlantLookupKey(latinName);

        if (!normalizedLatinName || seenLatinNames.has(normalizedLatinName)) {
          return false;
        }

        seenLatinNames.add(normalizedLatinName);
        return true;
      })
      .slice(0, getRemainingSlots());
    const suggestions = await Promise.all(
      suggestionsToHydrate.map((latinName) =>
        hydrateExternalSuggestion({
          latinName,
          imageUrl: null,
          source: 'ai',
        }),
      ),
    );

    pushResults(
      suggestions.filter((suggestion): suggestion is PlantSpeciesSuggestion =>
        Boolean(suggestion),
      ),
    );
  }

  return dedupeSuggestions(results).slice(0, 3);
}

export async function confirmPlantSpecies({
  latinName,
  commonName,
}: {
  latinName: string;
  commonName?: string;
}) {
  const species = await getOrCreatePlantSpecies(latinName);
  const trimmedCommonName = commonName?.trim();

  if (trimmedCommonName) {
    await storeSpeciesAliases(species.id, species.scientificName, [
      trimmedCommonName,
    ]);
  }

  return {
    speciesId: species.id,
  };
}
