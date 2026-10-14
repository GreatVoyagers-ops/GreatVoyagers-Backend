import bcrypt from "bcryptjs";
import Admin from "../models/Admin.js";
import Post from "../models/Post.js";
import seedPosts from "./posts/index.js";

export async function upsertAdmin({ email, password, name = "Admin" }) {
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env first.");
  if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters.");

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await Admin.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { $set: { passwordHash, name } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  return admin;
}

export async function insertSeedPosts() {
  let created = 0;
  for (const data of seedPosts) {
    if (await Post.exists({ slug: data.slug })) continue;
    await new Post(data).save();
    created += 1;
  }
  return { created, skipped: seedPosts.length - created };
}
