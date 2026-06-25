import { getNewToday, getGoneUnder24h, getCategoryHeat, getPriceBands } from "@market-radar-pl/db";
import NewListingsToday from "@/components/NewListingsToday";
import GoneUnder24h     from "@/components/GoneUnder24h";
import CategoryHeat     from "@/components/CategoryHeat";
import PriceBands       from "@/components/PriceBands";
import AddWatchUrl      from "@/components/AddWatchUrl";

export const revalidate = 60; // ISR: revalidate every 60 seconds

async function getData() {
  try {
    const [newToday, goneUnder24h, categoryHeat, priceBands] = await Promise.all([
      getNewToday(),
      getGoneUnder24h(),
      getCategoryHeat(),
      getPriceBands(),
    ]);
    return { newToday, goneUnder24h, categoryHeat, priceBands, error: null };
  } catch (err) {
    console.error("Dashboard data fetch error:", err);
    return {
      newToday:     [],
      goneUnder24h: [],
      categoryHeat: [],
      priceBands:   [],
      error: "Could not connect to database. Check DATABASE_URL.",
    };
  }
}

export default async function DashboardPage() {
  const { newToday, goneUnder24h, categoryHeat, priceBands, error } = await getData();

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1>Market Radar PL</h1>
          <p>Polish marketplace intelligence — public listings only</p>
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Updated: {new Date().toLocaleTimeString("pl-PL")}
        </span>
      </div>

      <AddWatchUrl />

      {error && (
        <div className="card" style={{ marginBottom: 24, borderColor: "var(--red)" }}>
          <p className="error-msg">{error}</p>
        </div>
      )}

      <div className="grid grid-2">
        <NewListingsToday listings={newToday} />
        <GoneUnder24h listings={goneUnder24h} />
        <CategoryHeat rows={categoryHeat} />
        <PriceBands rows={priceBands as { band_label: string; min_pln: number; max_pln: number | null; count: number }[]} />
      </div>
    </main>
  );
}
