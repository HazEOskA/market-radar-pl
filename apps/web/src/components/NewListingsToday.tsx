import type { Listing } from "@market-radar-pl/types";
import ListingCard from "./ListingCard";

interface Props {
  listings: Listing[];
}

export default function NewListingsToday({ listings }: Props) {
  return (
    <div className="card">
      <div className="card-title">
        New listings today
        <span className="badge badge-green" style={{ marginLeft: 8 }}>{listings.length}</span>
      </div>
      {listings.length === 0 ? (
        <p className="empty-state">No new listings in the last 24 hours</p>
      ) : (
        listings.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            badge={<span className="badge badge-green">New</span>}
          />
        ))
      )}
    </div>
  );
}
