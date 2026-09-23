-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "promptpayExtras" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "promptpayNumber" TEXT;
