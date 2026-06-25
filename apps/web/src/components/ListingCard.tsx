import type { Listing } from "@market-radar-pl/types";

interface Props {
  listing: Listing;
  badge?: React.ReactNode;
}

export default function ListingCard({ listing, badge }: Props) {
  const price = listing.price_pln != null
    ? `${listing.price_pln.toLocaleString("pl-PL")} PLN`
    : "Cena brak";

  return (
    <div className="listing-row">
      {listing.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="listing-thumb"
          src={listing.thumbnail_url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="listing-thumb-placeholder" />
      )}
      <div className="listing-info">
        <div className="listing-title">
          <a href={listing.url} target="_blank" rel="noopener noreferrer">
            {listing.title}
          </a>
        </div>
        <div className="listing-meta">
          <span className="price">{price}</span>
          {listing.location && <> &middot; {listing.location}</>}
          {listing.category && <> &middot; {listing.category}</>}
        </div>
      </div>
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        {badge}
        <ConfidenceDot level={listing.confidence} />
      </div>
    </div>
  );
}

function ConfidenceDot({ level }: { level: Listing["confidence"] }) {
  const labels: Record<typeof level, string> = {
    high:   "High confidence",
    medium: "Medium confidence",
    low:    "Low confidence",
  };
  return (
    <span title={labels[level]}>
      <span className={`confidence-dot confidence-${level}`} />
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{level}</span>
    </span>
  );
}
