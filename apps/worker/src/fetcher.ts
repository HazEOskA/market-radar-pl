import fetch from "node-fetch";
import { assertSafePublicUrl } from "./url-security.js";

const DELAY_MS = parseInt(process.env["FETCH_DELAY_SECONDS"] ?? "3", 10) * 1000;
const USER_AGENT =
  process.env["FETCH_USER_AGENT"] ??
  "Mozilla/5.0 (compatible; MarketRadarBot/1.0)";
const MAX_REDIRECTS = 5;

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

export async function rateLimitedFetch(rawUrl: string): Promise<FetchResult> {
  try {
    let currentUrl = await assertSafePublicUrl(rawUrl);

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      await politeDelay(currentUrl.toString());

      const response = await fetch(currentUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
        },
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          return { status: response.status, body: null, error: "Redirect without Location header" };
        }
        if (redirectCount === MAX_REDIRECTS) {
          return { status: response.status, body: null, error: "Too many redirects" };
        }

        const nextUrl = new URL(location, currentUrl);
        currentUrl = await assertSafePublicUrl(nextUrl.toString());
        continue;
      }

      const body = await response.text();
      return { status: response.status, body, error: null };
    }

    return { status: 0, body: null, error: "Redirect loop terminated unexpectedly" };
  } catch (err) {
    return { status: 0, body: null, error: String(err) };
  }
}
