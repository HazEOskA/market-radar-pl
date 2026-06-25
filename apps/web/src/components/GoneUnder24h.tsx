import type { Listing } from "@market-radar-pl/types";
import ListingCard from "./ListingCard";

interface Props {
  listings: Listing[];
}

function formatDuration(firstSeen: string, goneAt: string): string {
  const ms = new Date(goneAt).getTime() - new Date(firstSeen).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60)  return `${minutes}m`;
  const hours = Math.round(ms / 3_600_000);
  return `${hours}h`;
}

export default function GoneUnder24h({ listings }: Props) {
  return (
    <div className="card">
      <div className="card-title">
        Probable exits under 24 h
        <span className="badge badge-red" style={{ marginLeft: 8 }}>{listings.length}</span>
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
        Listings absent from source for 2+ checks after appearing within 24 h.
        Classified as &quot;probable exit&quot; — not confirmed sold.
      </p>
      {listings.length === 0 ? (
        <p className="empty-state">No short-lived exits detected</p>
      ) : (
        listings.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            badge={
              <span className="badge badge-red">
                Gone {l.probably_gone_at ? formatDuration(l.first_seen_at, l.probably_gone_at) : "–"}
              </span>
            }
          />
        ))
      )}
    </div>
  );
}
