// Seed demo accounts documented in the README. Idempotent: upsert by email.
// Run via `npx prisma db seed` (wired in package.json).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10); // matches src/lib/auth.ts rounds

  await prisma.user.upsert({
    where: { email: "owner@demo.com" },
    update: {},
    create: {
      name: "Owner Demo",
      email: "owner@demo.com",
      passwordHash,
      promptpayNumber: "0812345678",
    },
  });

  await prisma.user.upsert({
    where: { email: "friend@demo.com" },
    update: {},
    create: {
      name: "Friend Demo",
      email: "friend@demo.com",
      passwordHash,
    },
  });

  console.log("Seeded demo accounts: owner@demo.com, friend@demo.com (pw: 123456)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
