import { ZodError } from "zod";
import mongoose from "mongoose";

export function notFound(req, res) {
  res.status(404).json({ message: "Not found." });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "form";
      fields[key] ??= issue.message;
    }
    return res.status(400).json({ message: "Please check the highlighted fields.", fields });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(404).json({ message: "Not found." });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return res.status(409).json({ message: `That ${field} is already in use.`, fields: { [field]: "Already in use." } });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body." });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ message: "Request is too large." });
  }
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }

  console.error(err);
  res.status(500).json({ message: "Something went wrong. Please try again." });
}
