import { Router } from "express";
import Post from "../models/Post.js";

const router = Router();

const LIST_FIELDS = "-content -__v";

const visible = (extra = {}) => ({ status: "published", publishedAt: { $lte: new Date() }, ...extra });

const clampInt = (value, fallback, min, max) => {
  const number = Number.parseInt(value, 10);
  return Number.isNaN(number) ? fallback : Math.min(Math.max(number, min), max);
};

router.use((req, res, next) => {
  res.set("Cache-Control", "public, max-age=60");
  next();
});

router.get("/", async (req, res) => {
  const page = clampInt(req.query.page, 1, 1, 1000);
  const limit = clampInt(req.query.limit, 9, 1, 100);
  const category = typeof req.query.category === "string" ? req.query.category : "";
  const filter = visible(category ? { category } : {});

  const [posts, total, categories] = await Promise.all([
    Post.find(filter)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(LIST_FIELDS)
      .lean(),
    Post.countDocuments(filter),
    Post.distinct("category", visible()),
  ]);

  res.json({ posts, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), categories: categories.sort() });
});

router.get("/:slug", async (req, res) => {
  const post = await Post.findOne(visible({ slug: String(req.params.slug).toLowerCase() }))
    .select("-__v")
    .lean();
  if (!post) return res.status(404).json({ message: "Article not found." });

  const related = await Post.find(visible({ _id: { $ne: post._id }, category: post.category }))
    .sort({ publishedAt: -1 })
    .limit(3)
    .select(LIST_FIELDS)
    .lean();
  if (related.length < 3) {
    const exclude = [post._id, ...related.map((item) => item._id)];
    const more = await Post.find(visible({ _id: { $nin: exclude } }))
      .sort({ publishedAt: -1 })
      .limit(3 - related.length)
      .select(LIST_FIELDS)
      .lean();
    related.push(...more);
  }

  res.json({ post, related });
});

export default router;
