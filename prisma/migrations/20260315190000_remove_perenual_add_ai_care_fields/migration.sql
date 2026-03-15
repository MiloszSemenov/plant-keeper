-- AlterTable
ALTER TABLE "plant_species"
DROP COLUMN "provider_id",
DROP COLUMN "care_level",
DROP COLUMN "fetched_at",
ADD COLUMN "soil_type" TEXT,
ADD COLUMN "pet_toxic" BOOLEAN,
ADD COLUMN "care_notes" TEXT;
