// CLI entry point — for local/dev use, or `railway run npm run db:seed`.
// The actual seed data and logic live in src/lib/seed-data.ts, shared with
// the browser-triggerable /api/seed route for production setups where a
// terminal isn't assumed.

import { PrismaClient } from "@prisma/client";
import { runSeed } from "../src/lib/seed-data";

const prisma = new PrismaClient();

runSeed(prisma)
  .then((log) => {
    for (const line of log) console.log(line);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
