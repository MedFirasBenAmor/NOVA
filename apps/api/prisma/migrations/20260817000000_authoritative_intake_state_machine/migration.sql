-- R2 authoritative intake orchestration state.
CREATE TYPE "IntakePhase" AS ENUM (
  'PRODUCT_SELECTION',
  'CURRENT_INSURANCE',
  'CURRENT_POLICY_DOCUMENT',
  'CORE_DATA_COLLECTION',
  'COMPLETE'
);

ALTER TYPE "CollectionActionType" ADD VALUE 'ASK_CURRENT_INSURANCE';
ALTER TYPE "CollectionActionType" ADD VALUE 'ASK_POLICY_DOCUMENT';

ALTER TABLE "Lead"
  ADD COLUMN "intakePhase" "IntakePhase" NOT NULL DEFAULT 'PRODUCT_SELECTION',
  ADD COLUMN "currentAutoInsured" BOOLEAN,
  ADD COLUMN "currentHomeInsured" BOOLEAN,
  ADD COLUMN "currentAutoPolicyAvailable" BOOLEAN,
  ADD COLUMN "currentHomePolicyAvailable" BOOLEAN;

UPDATE "Lead"
SET "intakePhase" = CASE
  WHEN "selectedProduct" IS NULL THEN 'PRODUCT_SELECTION'::"IntakePhase"
  ELSE 'CORE_DATA_COLLECTION'::"IntakePhase"
END;
