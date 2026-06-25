import { NextRequest, NextResponse } from "next/server";
import { insertWatchUrl, getActiveWatchUrls } from "@market-radar-pl/db";
import type { Source } from "@market-radar-pl/types";

const ALLOWED_SOURCES: Source[] = ["olx", "allegro", "manual", "otodom", "sprzedajemy"];

function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
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

  if (typeof url !== "string" || !isValidUrl(url)) {
    return NextResponse.json({ error: "Invalid or missing 'url'" }, { status: 400 });
  }

  const resolvedSource: Source = (typeof source === "string" && ALLOWED_SOURCES.includes(source as Source))
    ? (source as Source)
    : "manual";

  try {
    const watchUrl = await insertWatchUrl({
      url,
      source: resolvedSource,
      label: typeof label === "string" ? label.trim() || null : null,
    });
    return NextResponse.json({ watchUrl }, { status: 201 });
  } catch (err) {
    console.error("[api/watch-urls] POST error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
