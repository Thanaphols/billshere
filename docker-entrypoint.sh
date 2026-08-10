#!/bin/sh
set -e

echo "Running prisma migrate deploy..."
node ./node_modules/prisma/build/index.js migrate deploy

echo "Seeding demo accounts (idempotent)..."
node prisma/seed.mjs || echo "Seed skipped/failed (non-fatal)"

echo "Starting Next.js..."
exec node server.js
