// Runs the API against a throwaway in-memory MongoDB, seeded with the admin and the 14 articles.
// Everything is lost when the process stops. Use `npm run dev` with MONGODB_URI for real data.
import { randomBytes } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";

const DEMO_EMAIL = "admin@greatvoyagers.com";
const DEMO_PASSWORD = "demo-admin-2026";

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri("greatvoyagers");
process.env.JWT_SECRET ||= randomBytes(48).toString("base64url");

const { default: config } = await import("../config.js");
const { connectDb } = await import("../db.js");
const { createApp } = await import("../app.js");
const { upsertAdmin, insertSeedPosts } = await import("../seed/seedLogic.js");

await connectDb(config.mongoUri);
const email = process.env.ADMIN_EMAIL || DEMO_EMAIL;
const password = process.env.ADMIN_PASSWORD || DEMO_PASSWORD;
await upsertAdmin({ email, password });
const { created } = await insertSeedPosts();

createApp().listen(config.port, () => {
  console.log(`\nDemo API running on http://localhost:${config.port} (in-memory database, ${created} posts)`);
  console.log(`Admin login: ${email} / ${process.env.ADMIN_PASSWORD ? "(your ADMIN_PASSWORD)" : password}\n`);
});

const shutdown = async () => {
  await mongo.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
