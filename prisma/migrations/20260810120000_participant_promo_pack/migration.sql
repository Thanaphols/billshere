-- Promo-pack sub-items on Participant. Also backfills Post.deletedAt, which was
-- previously introduced via `db push` and never captured in a migration — hence the
-- IF NOT EXISTS guards so this migration is a no-op for that column where it already exists.

-- Post soft-delete (bill bin) — repair missing migration history.
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Post_deletedAt_idx" ON "Post"("deletedAt");

-- Participant promo-pack metadata.
ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS "packId" TEXT;
ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS "packName" TEXT;
ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS "packPrice" DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS "Participant_packId_idx" ON "Participant"("packId");
