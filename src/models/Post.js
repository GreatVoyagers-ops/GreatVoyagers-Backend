import mongoose from "mongoose";

const WORDS_PER_MINUTE = 220;

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    coverImage: { type: String, required: true, trim: true },
    coverAlt: { type: String, default: "", trim: true },
    category: { type: String, required: true, trim: true },
    tags: { type: [String], default: [] },
    author: { type: String, default: "GreatVoyagers Team", trim: true },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    publishedAt: Date,
    metaTitle: { type: String, default: "", trim: true },
    metaDescription: { type: String, default: "", trim: true },
    readingTime: { type: Number, default: 1 },
  },
  { timestamps: true },
);

postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ status: 1, category: 1, publishedAt: -1 });

postSchema.pre("save", function () {
  if (this.isModified("content")) {
    const words = this.content.trim().split(/\s+/).filter(Boolean).length;
    this.readingTime = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  }
  if (this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

export default mongoose.models.Post || mongoose.model("Post", postSchema);
