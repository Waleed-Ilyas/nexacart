import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { errorMessage, useAdminStatsQuery } from "../../api";
import { ErrorBox, Skeleton, StatusBadge } from "../../components/ui";
import { money, moneyWhole } from "../../lib/format";

const tick = { fill: "#6b675d", fontSize: 12 };
const tip = { background: "#ffffff", border: "1px solid rgba(27,26,23,0.2)", borderRadius: 10, fontSize: 13 };
const day = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card p-5">
      <p className="label">{label}</p>
      <p className="display mt-2 text-4xl tabular-nums">{value}</p>
      {note && <p className="mt-1 text-sm text-ink-3">{note}</p>}
    </div>
  );
}

export default function Overview() {
  const { data, isLoading, isError, error, refetch } = useAdminStatsQuery();
  if (isLoading)
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  if (isError) return <ErrorBox message={errorMessage(error)} onRetry={refetch} />;
  const s = data!;
  const last30 = s.series.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue" value={moneyWhole(s.totals.revenue)} note="All paid orders" />
        <Stat label="Orders" value={String(s.totals.orders)} note="Paid, shipped or delivered" />
        <Stat label="Average order" value={money(s.totals.averageOrder)} />
        <Stat label="Customers" value={String(s.totals.customers)} />
      </div>

      <section className="card p-5" aria-labelledby="rev-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="rev-h" className="text-lg font-medium">
            Revenue, last 30 days
          </h2>
          <p className="text-sm text-ink-3">{moneyWhole(last30)} in total</p>
        </div>
        <div className="mt-4 h-72" role="img" aria-label={`Area chart of daily revenue over the last 30 days, ${moneyWhole(last30)} in total`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={s.series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c2410c" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#c2410c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(27,26,23,0.08)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => day.format(new Date(`${d}T00:00:00Z`))}
                tick={tick}
                axisLine={false}
                tickLine={false}
                minTickGap={32}
              />
              <YAxis tick={tick} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => moneyWhole(v)} />
              <Tooltip
                contentStyle={tip}
                labelFormatter={(d) => day.format(new Date(`${String(d)}T00:00:00Z`))}
                formatter={(v, name) => [name === "revenue" ? money(Number(v)) : String(v), name === "revenue" ? "Revenue" : "Orders"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#c2410c" strokeWidth={2} fill="url(#rev)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="top-h">
          <h2 id="top-h" className="text-lg font-medium">
            Top products by units sold
          </h2>
          {s.topProducts.length === 0 ? (
            <p className="mt-4 text-ink-3">No sales yet.</p>
          ) : (
            <div className="mt-4 h-64" role="img" aria-label={`Bar chart of top products: ${s.topProducts.map((t) => `${t.name} ${t.units}`).join(", ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.topProducts} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={tick} axisLine={false} tickLine={false} width={120} />
                  <Tooltip cursor={{ fill: "rgba(27,26,23,0.05)" }} contentStyle={tip} formatter={(v) => [String(v), "Units sold"]} />
                  <Bar dataKey="units" fill="#1b1a17" radius={[0, 6, 6, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="card p-5" aria-labelledby="st-h">
            <h2 id="st-h" className="text-lg font-medium">
              Orders by status
            </h2>
            <ul className="mt-4 space-y-2">
              {s.statuses.length === 0 && <li className="text-ink-3">No orders yet.</li>}
              {s.statuses.map((x) => (
                <li key={x.status} className="flex items-center justify-between">
                  <StatusBadge status={x.status} />
                  <span className="tabular-nums">{x.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5" aria-labelledby="ls-h">
            <h2 id="ls-h" className="text-lg font-medium">
              Low stock
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              {s.lowStock.length === 0 && <li className="text-ink-3">Everything is well stocked.</li>}
              {s.lowStock.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className={p.stock === 0 ? "font-medium text-bad" : "text-warn"}>{p.stock === 0 ? "Sold out" : `${p.stock} left`}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
