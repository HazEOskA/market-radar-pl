import { NextRequest, NextResponse } from "next/server";
import { insertWatchUrl, getActiveWatchUrls } from "@market-radar-pl/db";
import type { Source } from "@market-radar-pl/types";

const ALLOWED_SOURCES: Source[] = ["olx", "allegro", "manual", "otodom", "sprzedajemy"];

const SOURCE_HOSTS: Partial<Record<Source, string[]>> = {
  olx: ["olx.pl"],
  allegro: ["allegro.pl"],
  otodom: ["otodom.pl"],
  sprzedajemy: ["sprzedajemy.pl"],
};

function parseUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function hostMatches(hostname: string, allowedHost: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const allowed = allowedHost.toLowerCase().replace(/^\./, "").replace(/\.$/, "");
  return host === allowed || host.endsWith(`.${allowed}`);
}

function allowedHostsForSource(source: Source): string[] {
  if (source !== "manual") return SOURCE_HOSTS[source] ?? [];
  return (process.env["WATCH_URL_ALLOWED_HOSTS"] ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

function isAuthorizedAdminWrite(req: NextRequest): boolean {
  const token = process.env["WATCH_URL_ADMIN_TOKEN"];
  if (!token) return false;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

export async function GET() {
  try {
    const rows = await getActiveWatchUrls();
    return NextResponse.json({ watchUrls: rows });
  } catch (err) {
    console.error("[api/watch-urls] GET error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!process.env["WATCH_URL_ADMIN_TOKEN"]) {
    return NextResponse.json(
      { error: "Watch URL writes are disabled: WATCH_URL_ADMIN_TOKEN is not configured" },
      { status: 503 },
    );
  }

  if (!isAuthorizedAdminWrite(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const { url, source, label } = body as Record<string, unknown>;

  if (typeof source !== "string" || !ALLOWED_SOURCES.includes(source as Source)) {
    return NextResponse.json({ error: "Invalid or missing 'source'" }, { status: 400 });
  }
  const resolvedSource = source as Source;

  if (typeof url !== "string") {
    return NextResponse.json({ error: "Invalid or missing 'url'" }, { status: 400 });
  }
  const parsedUrl = parseUrl(url);
  if (!parsedUrl) {
    return NextResponse.json({ error: "Only credential-free HTTPS URLs are allowed" }, { status: 400 });
  }

  const allowedHosts = allowedHostsForSource(resolvedSource);
  if (allowedHosts.length === 0 || !allowedHosts.some((host) => hostMatches(parsedUrl.hostname, host))) {
    return NextResponse.json(
      { error: `Host is not allowlisted for source '${resolvedSource}'` },
      { status: 400 },
    );
  }

  try {
    const watchUrl = await insertWatchUrl({
      url: parsedUrl.toString(),
      source: resolvedSource,
      label: typeof label === "string" ? label.trim() || null : null,
    });
    return NextResponse.json({ watchUrl }, { status: 201 });
  } catch (err) {
    console.error("[api/watch-urls] POST error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
