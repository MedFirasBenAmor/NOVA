CREATE TYPE "ConversationMessageRole" AS ENUM ('CUSTOMER', 'NOVA', 'SYSTEM');
CREATE TYPE "CollectionActionType" AS ENUM ('SUGGEST_FULL_DOCUMENT', 'SUGGEST_TARGETED_CAPTURE', 'ASK_DATAPOINT', 'ASK_GROUPED_DATAPOINTS', 'CONFIRM_DATAPOINT', 'COMPLETE');
CREATE TYPE "CollectionAttemptStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'DECLINED', 'SKIPPED', 'COMPLETED', 'FAILED');

CREATE TABLE "ConversationMessage" (
  "id" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "role" "ConversationMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CollectionAttempt" (
  "id" UUID NOT NULL,
  "leadId" UUID NOT NULL,
  "entityType" "EntityType",
  "entityId" UUID,
  "actionType" "CollectionActionType" NOT NULL,
  "capabilityId" TEXT,
  "documentType" TEXT,
  "product" "Product" NOT NULL,
  "status" "CollectionAttemptStatus" NOT NULL DEFAULT 'PROPOSED',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "CollectionAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CollectionAttempt_leadId_createdAt_idx" ON "CollectionAttempt"("leadId", "createdAt");
ALTER TABLE "CollectionAttempt" ADD CONSTRAINT "CollectionAttempt_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
