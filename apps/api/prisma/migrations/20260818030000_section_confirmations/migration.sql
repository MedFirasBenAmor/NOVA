CREATE TYPE "SectionConfirmationStatus" AS ENUM (
  'COLLECTING',
  'READY_FOR_REVIEW',
  'CONFIRMED',
  'NEEDS_RECONFIRMATION'
);

ALTER TYPE "CollectionActionType" ADD VALUE 'REVIEW_SECTION';

CREATE TABLE "SectionConfirmation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customerFolderId" UUID NOT NULL,
  "product" "Product" NOT NULL,
  "sectionCode" TEXT NOT NULL,
  "status" "SectionConfirmationStatus" NOT NULL DEFAULT 'COLLECTING',
  "confirmedAt" TIMESTAMP(3),
  "snapshotHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SectionConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SectionConfirmation_customerFolderId_product_sectionCode_key"
  ON "SectionConfirmation"("customerFolderId", "product", "sectionCode");

CREATE INDEX "SectionConfirmation_customerFolderId_status_idx"
  ON "SectionConfirmation"("customerFolderId", "status");

ALTER TABLE "SectionConfirmation"
  ADD CONSTRAINT "SectionConfirmation_customerFolderId_fkey"
  FOREIGN KEY ("customerFolderId") REFERENCES "CustomerFolder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
