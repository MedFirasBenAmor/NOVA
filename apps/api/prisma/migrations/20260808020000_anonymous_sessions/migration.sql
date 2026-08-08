CREATE TABLE "AnonymousSession" (
  "id" UUID NOT NULL,
  "leadId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "AnonymousSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnonymousSession_tokenHash_key" ON "AnonymousSession"("tokenHash");
CREATE INDEX "AnonymousSession_leadId_idx" ON "AnonymousSession"("leadId");
CREATE INDEX "AnonymousSession_expiresAt_idx" ON "AnonymousSession"("expiresAt");
ALTER TABLE "AnonymousSession" ADD CONSTRAINT "AnonymousSession_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD COLUMN "processingProvider" TEXT,
  ADD COLUMN "candidatesDetected" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "candidatesAccepted" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "candidatesRejected" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "processingDurationMs" INTEGER;
