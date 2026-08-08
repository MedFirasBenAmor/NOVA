CREATE TYPE "DocumentType" AS ENUM ('DRIVER_LICENSE', 'CURRENT_AUTO_POLICY', 'VEHICLE_REGISTRATION', 'OTHER');
CREATE TYPE "DocumentCollectionMode" AS ENUM ('FULL_DOCUMENT', 'TARGETED_CAPTURE');
CREATE TYPE "DocumentStorageProvider" AS ENUM ('LOCAL');
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED', 'REJECTED');

CREATE TABLE "Document" (
  "id" UUID NOT NULL,
  "leadId" UUID NOT NULL,
  "customerFolderId" UUID NOT NULL,
  "collectionAttemptId" UUID,
  "entityType" "EntityType",
  "entityId" UUID,
  "documentType" "DocumentType" NOT NULL,
  "collectionMode" "DocumentCollectionMode" NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageProvider" "DocumentStorageProvider" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "uploadedAt" TIMESTAMP(3),
  "processingStartedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");
CREATE INDEX "Document_leadId_createdAt_idx" ON "Document"("leadId", "createdAt");
CREATE INDEX "Document_collectionAttemptId_idx" ON "Document"("collectionAttemptId");
ALTER TABLE "Document" ADD CONSTRAINT "Document_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_customerFolderId_fkey" FOREIGN KEY ("customerFolderId") REFERENCES "CustomerFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_collectionAttemptId_fkey" FOREIGN KEY ("collectionAttemptId") REFERENCES "CollectionAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
