import config from "../config.js";

const DEBOUNCE_MS = 60_000;
let timer = null;

/** Asks the frontend host to rebuild, so prerendered blog pages and the sitemap stay current. */
export function scheduleSiteRebuild() {
  if (!config.deployHookUrl) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const response = await fetch(config.deployHookUrl, { method: "POST" });
      console.log(`Deploy hook triggered (${response.status})`);
    } catch (error) {
      console.error("Deploy hook failed:", error.message);
    }
  }, DEBOUNCE_MS);
  timer.unref?.();
}
