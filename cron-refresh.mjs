/**
 * Cron script — called by Railway Cron service.
 * Makes a GET request to the main app's refresh endpoint, then exits.
 */
const APP_URL = process.env.APP_URL;
const CRON_SECRET = process.env.CRON_SECRET;

if (!APP_URL) {
  console.error("Missing APP_URL env var");
  process.exit(1);
}

console.log(`[Cron] Triggering refresh at ${APP_URL}/api/cron/refresh ...`);

try {
  const res = await fetch(`${APP_URL}/api/cron/refresh`, {
    headers: CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {},
  });

  const data = await res.json();
  console.log("[Cron] Response:", JSON.stringify(data, null, 2));
  process.exit(0);
} catch (err) {
  console.error("[Cron] Failed:", err.message);
  process.exit(1);
}
