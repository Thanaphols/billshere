-- Delivery fee is no longer split per participant; the owner enters the
-- number of people splitting it directly, and it's shown as a summary-only
-- figure decoupled from each participant's amountToPay.
ALTER TABLE "Post" ADD COLUMN "deliveryPersonCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Participant" DROP COLUMN "deliveryShare";
