import fetch from "node-fetch";

const DELAY_MS = parseInt(process.env["FETCH_DELAY_SECONDS"] ?? "3", 10) * 1000;
const USER_AGENT =
  process.env["FETCH_USER_AGENT"] ??
  "Mozilla/5.0 (compatible; MarketRadarBot/1.0)";

const domainTimestamps = new Map<string, number>();

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function politeDelay(url: string): Promise<void> {
  const domain = getDomain(url);
  const last = domainTimestamps.get(domain) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < DELAY_MS) {
    await new Promise((r) => setTimeout(r, DELAY_MS - elapsed));
  }
  domainTimestamps.set(domain, Date.now());
}

export interface FetchResult {
  status: number;
  body: string | null;
  error: string | null;
}

export async function rateLimitedFetch(url: string): Promise<FetchResult> {
  await politeDelay(url);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":      USER_AGENT,
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control":   "no-cache",
      },
      redirect: "follow",
    });

    const body = await response.text();
    return { status: response.status, body, error: null };
  } catch (err) {
    return { status: 0, body: null, error: String(err) };
  }
}
