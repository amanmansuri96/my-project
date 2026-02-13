import { intercomFetch } from "./client";
import type { IntercomAdmin, AdminListResponse } from "./types";

let adminCache: Map<string, IntercomAdmin> | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch all admins from Intercom.
 * Returns a map of adminId (string) → admin object.
 * Note: admin_assignee_id on conversations is a number, so callers
 * should convert to string when looking up: admins.get(String(id))
 */
export async function fetchAdmins(): Promise<Map<string, IntercomAdmin>> {
  if (adminCache && Date.now() - cacheTime < CACHE_TTL_MS) {
    return adminCache;
  }

  const response = await intercomFetch<AdminListResponse>("/admins");

  const admins = new Map<string, IntercomAdmin>();
  for (const admin of response.admins) {
    admins.set(admin.id, admin);
  }

  adminCache = admins;
  cacheTime = Date.now();
  console.log(`[Intercom] Fetched ${admins.size} admins`);
  return admins;
}

export function clearAdminCache(): void {
  adminCache = null;
  cacheTime = 0;
}
