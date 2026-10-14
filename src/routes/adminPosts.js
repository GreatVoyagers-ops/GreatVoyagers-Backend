import { Router } from "express";
import Post from "../models/Post.js";
import { postInputSchema } from "../lib/validation.js";
import { scheduleSiteRebuild } from "../lib/deployHook.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.use(requireAdmin);
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.get("/", async (req, res) => {
  const posts = await Post.find().sort({ updatedAt: -1 }).select("-content -__v").lean();
  res.json({ posts });
});

router.get("/:id", async (req, res) => {
  const post = await Post.findById(req.params.id).select("-__v").lean();
  if (!post) return res.status(404).json({ message: "Post not found." });
  res.json({ post });
});

router.post("/", async (req, res) => {
  const input = postInputSchema.parse(req.body ?? {});
  const post = await Post.create(input);
  if (post.status === "published") scheduleSiteRebuild();
  res.status(201).json({ post });
});

router.put("/:id", async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found." });

  const input = postInputSchema.parse(req.body ?? {});
  const wasPublished = post.status === "published";
  if (!input.publishedAt) delete input.publishedAt;
  post.set(input);
  await post.save();

  if (wasPublished || post.status === "published") scheduleSiteRebuild();
  res.json({ post });
});

router.delete("/:id", async (req, res) => {
  const post = await Post.findByIdAndDelete(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found." });
  if (post.status === "published") scheduleSiteRebuild();
  res.json({ ok: true });
});

export default router;
