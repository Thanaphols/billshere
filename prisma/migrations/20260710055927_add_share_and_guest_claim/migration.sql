-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "guestClaimToken" TEXT;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE INDEX "Participant_guestClaimToken_idx" ON "Participant"("guestClaimToken");

-- CreateIndex
CREATE UNIQUE INDEX "Post_shareToken_key" ON "Post"("shareToken");

