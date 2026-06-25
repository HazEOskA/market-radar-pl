interface PriceBandRow {
  band_label: string;
  min_pln:    number;
  max_pln:    number | null;
  count:      number;
}

interface Props {
  rows: PriceBandRow[];
}

export default function PriceBands({ rows }: Props) {
  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="card">
      <div className="card-title">Price bands (active listings)</div>
      {rows.length === 0 ? (
        <p className="empty-state">No pricing data yet</p>
      ) : (
        rows.map((row) => (
          <div key={row.band_label} className="price-band-row">
            <span style={{ fontSize: 13 }}>{row.band_label}</span>
            <div className="bar-container">
              <div
                className="bar-fill"
                style={{ width: `${(row.count / maxCount) * 100}%` }}
              />
            </div>
            <span style={{ fontSize: 13, textAlign: "right", color: "var(--muted)" }}>
              {row.count}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
