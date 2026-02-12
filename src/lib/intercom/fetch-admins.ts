import { intercomFetch } from "./client";
import type { IntercomAdmin, IntercomPaginatedResponse } from "./types";

let adminCache: Map<string, IntercomAdmin> | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchAdmins(): Promise<Map<string, IntercomAdmin>> {
  if (adminCache && Date.now() - cacheTime < CACHE_TTL_MS) {
    return adminCache;
  }

  const response = await intercomFetch<IntercomPaginatedResponse<IntercomAdmin>>(
    "/admins"
  );

  const admins = new Map<string, IntercomAdmin>();
  for (const admin of response.data) {
    admins.set(admin.id, admin);
  }

  adminCache = admins;
  cacheTime = Date.now();
  return admins;
}

export function clearAdminCache(): void {
  adminCache = null;
  cacheTime = 0;
}
