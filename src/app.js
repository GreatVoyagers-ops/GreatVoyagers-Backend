import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import config from "./config.js";
import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import adminPostRoutes from "./routes/adminPosts.js";
import publicEnquiryRoutes from "./routes/publicEnquiries.js";
import dashboardRoutes from "./routes/crm/dashboard.js";
import enquiryRoutes from "./routes/crm/enquiries.js";
import customerRoutes from "./routes/crm/customers.js";
import vendorRoutes from "./routes/crm/vendors.js";
import quoteRoutes from "./routes/crm/quotes.js";
import settingsRoutes from "./routes/crm/settings.js";
import publicQuoteRoutes from "./routes/publicQuotes.js";
import { serveStaticSite } from "./staticSite.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(cors({ origin: config.clientOrigins, credentials: true }));
  // Spreadsheet imports send up to 5,000 rows in one request; everything else keeps the small limit.
  app.post(["/api/admin/customers/import", "/api/admin/vendors/import"], express.json({ limit: "8mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/api/enquiries", publicEnquiryRoutes);
  app.use("/api/admin/posts", adminPostRoutes);
  app.use("/api/admin/dashboard", dashboardRoutes);
  app.use("/api/admin/enquiries", enquiryRoutes);
  app.use("/api/admin/customers", customerRoutes);
  app.use("/api/admin/vendors", vendorRoutes);
  app.use("/api/quotes", publicQuoteRoutes);
  app.use("/api/admin/quotes", quoteRoutes);
  app.use("/api/admin/settings", settingsRoutes);

  serveStaticSite(app);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
