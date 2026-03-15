ALTER TABLE "vault_invites"
ADD COLUMN "code" TEXT;

CREATE UNIQUE INDEX "vault_invites_code_key" ON "vault_invites"("code");
