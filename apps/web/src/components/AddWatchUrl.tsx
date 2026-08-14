export default function AddWatchUrl() {
  return (
    <div className="card" style={{ marginBottom: 32 }}>
      <strong>Watch URL management is admin-only.</strong>
      <p style={{ marginBottom: 0, color: "var(--muted)" }}>
        The public dashboard is read-only. New watch URLs must be added through the protected server endpoint or directly in PostgreSQL.
      </p>
    </div>
  );
}
