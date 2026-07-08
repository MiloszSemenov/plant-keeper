export const FREE_MONTHLY_PHOTO_IDENTIFICATIONS = 5;
export const MAX_PLANTS_PER_VAULT = 50;

const DEFAULT_GLOBAL_DAILY_PHOTO_IDENTIFICATIONS = 30;

export function getGlobalDailyPhotoIdentificationLimit() {
  const raw = Number(process.env.IDENTIFY_GLOBAL_DAILY_LIMIT);

  return Number.isInteger(raw) && raw > 0
    ? raw
    : DEFAULT_GLOBAL_DAILY_PHOTO_IDENTIFICATIONS;
}
