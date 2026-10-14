import jwt from "jsonwebtoken";
import config from "../config.js";
import Admin from "../models/Admin.js";

export async function requireAdmin(req, res, next) {
  const token = req.cookies?.[config.cookieName];
  if (!token) return res.status(401).json({ message: "Please log in." });

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ message: "Your session has expired. Please log in again." });
  }

  const admin = await Admin.findById(payload.sub);
  if (!admin) return res.status(401).json({ message: "Please log in." });

  req.admin = admin;
  next();
}
