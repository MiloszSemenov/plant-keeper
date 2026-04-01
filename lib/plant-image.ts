export type ImageContext = 'suggestion' | 'plant' | 'species' | 'identify';

export function resolvePlantImage({
  context,
  plantImageUrl,
  speciesDefaultImageUrl,
  wikipediaImageUrl,
}: {
  context: ImageContext;
  plantImageUrl?: string | null;
  speciesDefaultImageUrl?: string | null;
  wikipediaImageUrl?: string | null;
}) {
  if (context === 'suggestion' || context === 'identify') {
    return speciesDefaultImageUrl ?? wikipediaImageUrl ?? null;
  }

  if (context === 'plant') {
    return plantImageUrl ?? speciesDefaultImageUrl ?? null;
  }

  return speciesDefaultImageUrl ?? null;
}
