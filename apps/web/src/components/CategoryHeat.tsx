import type { CategoryHeatRow } from "@market-radar-pl/types";

interface Props {
  rows: CategoryHeatRow[];
}

export default function CategoryHeat({ rows }: Props) {
  return (
    <div className="card">
      <div className="card-title">Category heat</div>
      <div className="heat-row heat-header">
        <span>Category</span>
        <span style={{ textAlign: "right" }}>New</span>
        <span style={{ textAlign: "right" }}>Gone</span>
        <span style={{ textAlign: "right" }}>Avg price</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty-state">No category data yet</p>
      ) : (
        rows.map((row) => (
          <div key={row.category} className="heat-row">
            <span>{row.category}</span>
            <span style={{ textAlign: "right" }}>
              <span className="badge badge-green">{row.new_today}</span>
            </span>
            <span style={{ textAlign: "right" }}>
              <span className="badge badge-red">{row.gone_under_24h}</span>
            </span>
            <span style={{ textAlign: "right", fontSize: 12, color: "var(--muted)" }}>
              {row.avg_price_pln != null
                ? `${Number(row.avg_price_pln).toLocaleString("pl-PL")} PLN`
                : "–"}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
