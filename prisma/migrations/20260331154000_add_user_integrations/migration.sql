CREATE TABLE IF NOT EXISTS "user_integrations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "calendar_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_integrations_user_id_provider_key"
ON "user_integrations"("user_id", "provider");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'user_integrations'
          AND constraint_name = 'user_integrations_user_id_fkey'
    ) THEN
        ALTER TABLE "user_integrations"
        ADD CONSTRAINT "user_integrations_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END $$;
