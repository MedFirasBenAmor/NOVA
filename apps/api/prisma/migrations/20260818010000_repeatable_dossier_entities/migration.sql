-- CreateEnum
CREATE TYPE "EntityDomain" AS ENUM ('NONE', 'AUTO', 'HOME');

-- CreateEnum
CREATE TYPE "CollectionLoopStatus" AS ENUM ('COLLECTING', 'CLOSED');

-- AlterEnum
ALTER TYPE "CollectionActionType" ADD VALUE 'ASK_ADD_ANOTHER_ENTITY';

-- DropIndex
DROP INDEX "DossierEntity_customerFolderId_entityType_role_ordinal_key";
DROP INDEX "DossierEntity_customerFolderId_entityType_role_idx";

-- AlterTable
ALTER TABLE "DossierEntity" ADD COLUMN "domain" "EntityDomain" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "CollectionLoop" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customerFolderId" UUID NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "role" "EntityRole" NOT NULL,
    "domain" "EntityDomain" NOT NULL DEFAULT 'NONE',
    "status" "CollectionLoopStatus" NOT NULL DEFAULT 'COLLECTING',
    "currentOrdinal" INTEGER NOT NULL,
    "triggerKey" TEXT,
    "createdByAttemptId" UUID,
    "closedByAttemptId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CollectionLoop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DossierEntity_customerFolderId_entityType_role_domain_ordinal_key" ON "DossierEntity"("customerFolderId", "entityType", "role", "domain", "ordinal");
CREATE INDEX "DossierEntity_customerFolderId_entityType_role_domain_idx" ON "DossierEntity"("customerFolderId", "entityType", "role", "domain");
CREATE UNIQUE INDEX "CollectionLoop_customerFolderId_entityType_role_domain_key" ON "CollectionLoop"("customerFolderId", "entityType", "role", "domain");
CREATE UNIQUE INDEX "CollectionLoop_createdByAttemptId_key" ON "CollectionLoop"("createdByAttemptId");
CREATE UNIQUE INDEX "CollectionLoop_closedByAttemptId_key" ON "CollectionLoop"("closedByAttemptId");
CREATE INDEX "CollectionLoop_customerFolderId_status_idx" ON "CollectionLoop"("customerFolderId", "status");

-- AddForeignKey
ALTER TABLE "CollectionLoop" ADD CONSTRAINT "CollectionLoop_customerFolderId_fkey" FOREIGN KEY ("customerFolderId") REFERENCES "CustomerFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
