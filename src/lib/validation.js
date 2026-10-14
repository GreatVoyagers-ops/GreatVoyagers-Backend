import slugify from "slugify";
import { z } from "zod";

export const toSlug = (value) => slugify(value, { lower: true, strict: true, trim: true });

const optionalText = (max) => z.string().trim().max(max).optional().default("");

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const postInputSchema = z
  .object({
    title: z.string().trim().min(3, "Title is too short.").max(140, "Keep the title under 140 characters."),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only.")
      .optional()
      .or(z.literal("")),
    excerpt: z.string().trim().min(20, "Write at least 20 characters.").max(320, "Keep the excerpt under 320 characters."),
    content: z.string().trim().min(50, "The article needs at least 50 characters."),
    coverImage: z.url({ protocol: /^https?$/, message: "Enter a full image URL starting with https://" }),
    coverAlt: optionalText(180),
    category: z.string().trim().min(2, "Choose a category.").max(40),
    tags: z.array(z.string().trim().min(1).max(40)).max(12).optional().default([]),
    author: z.string().trim().max(80).optional().default("GreatVoyagers Team"),
    status: z.enum(["draft", "published"]).default("draft"),
    publishedAt: z.coerce.date().optional().nullable(),
    metaTitle: optionalText(70),
    metaDescription: optionalText(170),
  })
  .transform((post) => ({
    ...post,
    slug: post.slug || toSlug(post.title),
    tags: [...new Set(post.tags.map((tag) => tag.toLowerCase()))],
    author: post.author || "GreatVoyagers Team",
  }));
