-- AlterEnum
ALTER TYPE "CollectionActionType" ADD VALUE IF NOT EXISTS 'ASSIGN_ENTITY_RELATION';

-- CreateEnum
CREATE TYPE "EntityRelationType" AS ENUM ('DRIVER_VEHICLE_PRIMARY', 'DRIVER_VEHICLE_OCCASIONAL', 'CLAIM_DRIVER', 'CLAIM_VEHICLE');

-- CreateTable
CREATE TABLE "EntityRelation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customerFolderId" UUID NOT NULL,
    "fromEntityId" UUID NOT NULL,
    "toEntityId" UUID NOT NULL,
    "relationType" "EntityRelationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EntityRelation_customerFolderId_fromEntityId_toEntityId_relationType_key" ON "EntityRelation"("customerFolderId", "fromEntityId", "toEntityId", "relationType");

-- CreateIndex
CREATE INDEX "EntityRelation_customerFolderId_relationType_idx" ON "EntityRelation"("customerFolderId", "relationType");

-- CreateIndex
CREATE INDEX "EntityRelation_fromEntityId_relationType_idx" ON "EntityRelation"("fromEntityId", "relationType");

-- CreateIndex
CREATE INDEX "EntityRelation_toEntityId_relationType_idx" ON "EntityRelation"("toEntityId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "EntityRelation_one_primary_driver_per_vehicle" ON "EntityRelation"("customerFolderId", "toEntityId") WHERE "relationType" = 'DRIVER_VEHICLE_PRIMARY';

-- AddForeignKey
ALTER TABLE "EntityRelation" ADD CONSTRAINT "EntityRelation_customerFolderId_fkey" FOREIGN KEY ("customerFolderId") REFERENCES "CustomerFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelation" ADD CONSTRAINT "EntityRelation_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "DossierEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelation" ADD CONSTRAINT "EntityRelation_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "DossierEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
