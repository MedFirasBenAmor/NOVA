/*
  Warnings:

  - A unique constraint covering the columns `[leadId]` on the table `CustomerFolder` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Product" AS ENUM ('COMMON', 'AUTO', 'HOME');

-- CreateEnum
CREATE TYPE "DataType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'ENUM', 'OBJECT');

-- CreateEnum
CREATE TYPE "RequirementType" AS ENUM ('REQUIRED', 'OPTIONAL', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'BLOCKING');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('CUSTOMER_CHAT', 'CUSTOMER_FORM', 'CUSTOMER_CONFIRMATION', 'EXISTING_NOVA', 'FULL_DOCUMENT', 'TARGETED_DOCUMENT_CAPTURE', 'EXTERNAL_API', 'BROKER', 'DERIVED', 'ENRICHED');

-- CreateEnum
CREATE TYPE "CollectionMethod" AS ENUM ('REUSED', 'EXTRACTED', 'TARGETED_CAPTURE', 'API_FETCHED', 'DERIVED', 'ENRICHED', 'CONFIRMED', 'MANUAL_QUESTION', 'MANUAL_ENTRY', 'BROKER_ENTERED');

-- CreateEnum
CREATE TYPE "DatapointStatus" AS ENUM ('MISSING', 'CANDIDATE', 'EXTRACTED', 'INFERRED', 'ENRICHED', 'CONFIRMED', 'CONFLICTING', 'VALIDATED', 'REJECTED', 'EXPIRED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('CUSTOMER', 'VEHICLE', 'DRIVER', 'CLAIM', 'REQUEST');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "leadId" UUID;

-- AlterTable
ALTER TABLE "CustomerFolder" ADD COLUMN     "leadId" UUID,
ALTER COLUMN "customerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DatapointDefinition" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "product" "Product" NOT NULL,
    "category" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "dataType" "DataType" NOT NULL,
    "requirementType" "RequirementType" NOT NULL,
    "requiredWhen" JSONB,
    "possibleSources" "SourceType"[],
    "preferredCollectionMethods" "CollectionMethod"[],
    "validationRules" JSONB,
    "riskImpact" "ImpactLevel" NOT NULL,
    "eligibilityImpact" "ImpactLevel" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatapointDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatapointValue" (
    "id" UUID NOT NULL,
    "customerFolderId" UUID NOT NULL,
    "definitionId" UUID NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" UUID,
    "scopeKey" TEXT NOT NULL,
    "value" JSONB,
    "status" "DatapointStatus" NOT NULL DEFAULT 'CANDIDATE',
    "confidence" DOUBLE PRECISION,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatapointValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatapointSource" (
    "id" UUID NOT NULL,
    "datapointValueId" UUID NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "collectionMethod" "CollectionMethod" NOT NULL,
    "sourceReferenceId" TEXT,
    "observedValue" JSONB,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatapointSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DatapointDefinition_product_active_idx" ON "DatapointDefinition"("product", "active");

-- CreateIndex
CREATE UNIQUE INDEX "DatapointDefinition_key_version_key" ON "DatapointDefinition"("key", "version");

-- CreateIndex
CREATE INDEX "DatapointValue_customerFolderId_entityType_entityId_idx" ON "DatapointValue"("customerFolderId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "DatapointValue_customerFolderId_definitionId_scopeKey_key" ON "DatapointValue"("customerFolderId", "definitionId", "scopeKey");

-- CreateIndex
CREATE INDEX "DatapointSource_datapointValueId_createdAt_idx" ON "DatapointSource"("datapointValueId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerFolder_leadId_key" ON "CustomerFolder"("leadId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFolder" ADD CONSTRAINT "CustomerFolder_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatapointValue" ADD CONSTRAINT "DatapointValue_customerFolderId_fkey" FOREIGN KEY ("customerFolderId") REFERENCES "CustomerFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatapointValue" ADD CONSTRAINT "DatapointValue_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "DatapointDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatapointSource" ADD CONSTRAINT "DatapointSource_datapointValueId_fkey" FOREIGN KEY ("datapointValueId") REFERENCES "DatapointValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
