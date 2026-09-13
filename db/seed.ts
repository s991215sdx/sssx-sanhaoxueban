import { getDb } from "../api/queries/connection";
import { runSeed } from "./seed-core";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");
  const n = await runSeed(db);
  console.log(`Done. ${n} knowledge points seeded.`);
  process.exit(0);
}

seed();
