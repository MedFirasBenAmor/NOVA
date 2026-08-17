-- R3 authoritative dossier entity registry.
CREATE TYPE "EntityRole" AS ENUM ('PRIMARY', 'ADDITIONAL', 'REPEATABLE');

CREATE TABLE "DossierEntity" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customerFolderId" UUID NOT NULL,
  "entityType" "EntityType" NOT NULL,
  "role" "EntityRole" NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DossierEntity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DossierEntity"
  ADD CONSTRAINT "DossierEntity_customerFolderId_fkey"
  FOREIGN KEY ("customerFolderId") REFERENCES "CustomerFolder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "DossierEntity_customerFolderId_entityType_role_ordinal_key"
  ON "DossierEntity"("customerFolderId", "entityType", "role", "ordinal");

CREATE INDEX "DossierEntity_customerFolderId_entityType_role_idx"
  ON "DossierEntity"("customerFolderId", "entityType", "role");
