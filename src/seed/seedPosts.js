import config from "../config.js";
import { connectDb, disconnectDb } from "../db.js";
import { insertSeedPosts } from "./seedLogic.js";

try {
  if (!config.mongoUri) throw new Error("Set MONGODB_URI in backend/.env first.");
  await connectDb(config.mongoUri);
  const { created, skipped } = await insertSeedPosts();
  console.log(`Blog posts seeded: ${created} created, ${skipped} already existed.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
