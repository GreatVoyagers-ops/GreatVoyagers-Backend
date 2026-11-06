import fs from "node:fs";
import path from "node:path";
import express from "express";
import config from "./config.js";

function resolveStaticDir() {
  if (config.staticDir) return path.resolve(config.staticDir);
  const fallback = path.resolve("public");
  return fs.existsSync(path.join(fallback, "index.html")) ? fallback : "";
}

function sendHtml(res, filePath) {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(filePath);
}

/**
 * Optional: serve the Vite build from /public (or STATIC_DIR) from this same process.
 * Used if you deploy frontend + API as one Hostinger Express app. Leave unused when
 * the frontend is a separate Hostinger static site.
 */
export function serveStaticSite(app) {
  const root = resolveStaticDir();
  if (!root) return;

  const spaIndex = path.join(root, "index.html");
  if (!fs.existsSync(spaIndex)) return;

  app.use(
    express.static(root, {
      index: false,
      redirect: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();

    if (req.path.startsWith("/admin") || req.path.startsWith("/q/")) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
    }
    if (req.path.startsWith("/q/")) {
      res.setHeader("Referrer-Policy", "no-referrer");
    }

    const nested = path.normalize(path.join(root, req.path, "index.html"));
    if (nested.startsWith(root) && fs.existsSync(nested)) {
      sendHtml(res, nested);
      return;
    }

    sendHtml(res, spaIndex);
  });
}
