import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import config, { isProduction } from "../config.js";
import Admin from "../models/Admin.js";
import { loginSchema } from "../lib/validation.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please wait 15 minutes and try again." },
});

const cookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/api",
});

const publicAdmin = (admin) => ({ id: admin.id, email: admin.email, name: admin.name });

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body ?? {});
  const admin = await Admin.findOne({ email }).select("+passwordHash");
  const valid = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);

  if (!admin || !valid) {
    return res.status(401).json({ message: "Incorrect email or password." });
  }

  admin.lastLoginAt = new Date();
  await admin.save();

  const token = jwt.sign({ sub: admin.id }, config.jwtSecret, { expiresIn: `${config.sessionDays}d` });
  res.cookie(config.cookieName, token, { ...cookieOptions(), maxAge: config.sessionDays * 24 * 60 * 60 * 1000 });
  res.json({ admin: publicAdmin(admin) });
});

router.post("/logout", (req, res) => {
  res.clearCookie(config.cookieName, cookieOptions());
  res.json({ ok: true });
});

router.get("/me", requireAdmin, (req, res) => {
  res.json({ admin: publicAdmin(req.admin) });
});

export default router;
