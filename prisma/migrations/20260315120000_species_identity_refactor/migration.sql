-- CreateEnum
CREATE TYPE "PlantSpeciesSource_new" AS ENUM ('seed', 'perenual', 'ai');

-- DropForeignKey
ALTER TABLE "plants" DROP CONSTRAINT "plants_species_name_fkey";

-- AlterTable
ALTER TABLE "plant_species" RENAME COLUMN "species_name" TO "scientific_name";
ALTER TABLE "plant_species" ADD COLUMN "normalized_lookup_key" TEXT;
ALTER TABLE "plant_species" ADD COLUMN "provider_id" TEXT;
ALTER TABLE "plant_species" ADD COLUMN "fetched_at" TIMESTAMP(3);

-- MigrateData
UPDATE "plant_species"
SET "normalized_lookup_key" = LOWER(TRIM(REGEXP_REPLACE("scientific_name", '\s+', ' ', 'g')));

-- AlterTable
ALTER TABLE "plant_species" ALTER COLUMN "normalized_lookup_key" SET NOT NULL;
ALTER TABLE "plant_species"
ALTER COLUMN "source" TYPE "PlantSpeciesSource_new"
USING (
  CASE
    WHEN "source"::TEXT = 'plant_api' THEN 'seed'
    WHEN "source"::TEXT = 'ai_generated' THEN 'ai'
    ELSE 'ai'
  END
)::"PlantSpeciesSource_new";

-- CreateTable
CREATE TABLE "plant_species_aliases" (
    "id" UUID NOT NULL,
    "species_id" UUID NOT NULL,
    "alias_name" TEXT NOT NULL,
    "normalized_alias_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_species_aliases_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "plants" ADD COLUMN "species_id" UUID;
ALTER TABLE "plants" ADD COLUMN "custom_watering_interval_days" INTEGER;

-- MigrateData
UPDATE "plants"
SET "species_id" = "plant_species"."id"
FROM "plant_species"
WHERE "plants"."species_name" = "plant_species"."scientific_name";

-- AlterTable
ALTER TABLE "plants" ALTER COLUMN "species_id" SET NOT NULL;
ALTER TABLE "plants" DROP COLUMN "species_name";
ALTER TABLE "plants" DROP COLUMN "watering_interval_days";

-- DropIndex
DROP INDEX "plant_species_species_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "plant_species_scientific_name_key" ON "plant_species"("scientific_name");
CREATE UNIQUE INDEX "plant_species_normalized_lookup_key_key" ON "plant_species"("normalized_lookup_key");
CREATE UNIQUE INDEX "plant_species_provider_id_key" ON "plant_species"("provider_id");
CREATE UNIQUE INDEX "plant_species_aliases_normalized_alias_key_key" ON "plant_species_aliases"("normalized_alias_key");
CREATE UNIQUE INDEX "plant_species_aliases_species_id_normalized_alias_key_key" ON "plant_species_aliases"("species_id", "normalized_alias_key");

-- AddForeignKey
ALTER TABLE "plant_species_aliases" ADD CONSTRAINT "plant_species_aliases_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "plant_species"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plants" ADD CONSTRAINT "plants_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "plant_species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropEnum
DROP TYPE "PlantSpeciesSource";

-- RenameType
ALTER TYPE "PlantSpeciesSource_new" RENAME TO "PlantSpeciesSource";
