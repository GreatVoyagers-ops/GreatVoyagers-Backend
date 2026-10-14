import config from "./config.js";

/**
 * Render's free plan sleeps a service after 15 minutes without incoming traffic.
 * Pinging our own public URL counts as incoming traffic and keeps it awake.
 * Off unless a public URL is known, so it never runs on a laptop.
 */
export function startKeepAlive() {
  const baseUrl = config.keepAliveUrl;
  if (!baseUrl) return;

  const target = `${baseUrl.replace(/\/+$/, "")}/api/health`;
  const intervalMs = config.keepAliveMinutes * 60 * 1000;

  const ping = async () => {
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(30_000), headers: { "User-Agent": "GreatVoyagers-keep-alive" } });
      if (!res.ok) console.warn(`Keep-alive ping got HTTP ${res.status} from ${target}`);
    } catch (err) {
      console.warn(`Keep-alive ping to ${target} failed: ${err.message}`);
    }
  };

  setInterval(ping, intervalMs).unref();
  console.log(`Keep-alive: pinging ${target} every ${config.keepAliveMinutes} minutes`);
}
