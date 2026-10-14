import config from "../config.js";
import { connectDb, disconnectDb } from "../db.js";
import { upsertAdmin } from "./seedLogic.js";

try {
  if (!config.mongoUri) throw new Error("Set MONGODB_URI in backend/.env first.");
  await connectDb(config.mongoUri);
  const admin = await upsertAdmin({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  console.log(`Admin ready: ${admin.email}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
