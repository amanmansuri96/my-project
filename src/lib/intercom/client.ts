const INTERCOM_BASE_URL = "https://api.intercom.io";
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

function getToken(): string {
  const token = process.env.INTERCOM_ACCESS_TOKEN;
  if (!token) throw new Error("INTERCOM_ACCESS_TOKEN is not set");
  return token;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function intercomFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${INTERCOM_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, { ...options, headers });

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    // Rate limited — back off and retry
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      console.warn(
        `Intercom rate limited. Waiting ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
      );
      await sleep(waitMs);
      continue;
    }

    // Server error — retry with backoff
    if (response.status >= 500 && attempt < MAX_RETRIES) {
      const waitMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      console.warn(
        `Intercom server error ${response.status}. Retrying in ${waitMs}ms`
      );
      await sleep(waitMs);
      continue;
    }

    const body = await response.text();
    throw new Error(
      `Intercom API error ${response.status}: ${body}`
    );
  }

  throw new Error(`Intercom API: max retries exceeded`);
}
