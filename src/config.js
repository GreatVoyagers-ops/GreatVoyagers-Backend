const env = process.env;

export const isProduction = env.NODE_ENV === "production";

const config = {
  port: Number(env.PORT) || 5000,
  mongoUri: env.MONGODB_URI,
  jwtSecret: env.JWT_SECRET,
  clientOrigins: (env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: Number(env.TRUST_PROXY ?? 1),
  deployHookUrl: env.VERCEL_DEPLOY_HOOK_URL || "",
  // Render sets RENDER_EXTERNAL_URL automatically; KEEP_ALIVE_URL=off disables the pinger.
  keepAliveUrl: env.KEEP_ALIVE_URL === "off" ? "" : env.KEEP_ALIVE_URL || env.RENDER_EXTERNAL_URL || "",
  keepAliveMinutes: Math.min(Math.max(Number(env.KEEP_ALIVE_MINUTES) || 10, 1), 14),
  cookieName: "gv_admin",
  sessionDays: 7,
};

export function assertConfig() {
  const missing = [];
  if (!config.mongoUri) missing.push("MONGODB_URI");
  if (!config.jwtSecret) missing.push("JWT_SECRET");
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}. Copy .env.example to .env and fill them in.`);
  }
  if (config.jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }
}

export default config;
