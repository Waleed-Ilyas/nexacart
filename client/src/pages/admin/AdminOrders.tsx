import { useState } from "react";
import { errorMessage, useAdminOrdersQuery, useSetOrderStatusMutation } from "../../api";
import { Empty, ErrorBox, Skeleton, StatusBadge } from "../../components/ui";
import { formatDate, money } from "../../lib/format";
import type { OrderStatus } from "../../types";

const FILTERS: ("all" | OrderStatus)[] = ["all", "paid", "shipped", "delivered", "cancelled"];
const NEXT: Record<string, ("shipped" | "delivered" | "cancelled")[]> = { paid: ["shipped", "cancelled"], shipped: ["delivered"] };
const LABEL = { shipped: "Mark shipped", delivered: "Mark delivered", cancelled: "Cancel and restock" } as const;

export default function AdminOrders() {
  const [status, setStatus] = useState<"all" | OrderStatus>("all");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminOrdersQuery({ status: status === "all" ? undefined : status, page });
  const [setOrderStatus, { isLoading: saving }] = useSetOrderStatusMutation();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const change = async (id: string, next: "shipped" | "delivered" | "cancelled") => {
    if (next === "cancelled" && !window.confirm("Cancel this order and put its items back in stock? Refunds are issued from the Stripe dashboard.")) return;
    setMessage(null);
    try {
      await setOrderStatus({ id, status: next }).unwrap();
      setMessage({ ok: true, text: `Order marked ${next}.` });
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) });
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter orders by status">
        {FILTERS.map((f) => (
          <button key={f} className="chip capitalize" aria-pressed={status === f} onClick={() => (setStatus(f), setPage(1))}>
            {f}
          </button>
        ))}
      </div>
      <p role="status" className={`mt-3 min-h-6 text-sm ${message?.ok ? "text-ok" : "text-bad"}`}>
        {message?.text}
      </p>

      {isLoading ? (
        <Skeleton className="mt-2 h-64" />
      ) : isError ? (
        <ErrorBox message={errorMessage(error)} onRetry={refetch} />
      ) : data!.orders.length === 0 ? (
        <Empty title="No orders here" />
      ) : (
        <div className={`card overflow-x-auto ${isFetching ? "opacity-70" : ""}`}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-ink-3">
              <tr>
                <th className="p-3 font-normal">Order</th>
                <th className="p-3 font-normal">Customer</th>
                <th className="p-3 font-normal">Items</th>
                <th className="p-3 text-right font-normal">Total</th>
                <th className="p-3 font-normal">Status</th>
                <th className="p-3 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data!.orders.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0">
                  <td className="p-3">
                    <span className="font-mono">#{o.id.slice(-6).toUpperCase()}</span>
                    <span className="block text-xs text-ink-3">{formatDate(o.paidAt ?? o.createdAt)}</span>
                  </td>
                  <td className="p-3">
                    {o.customer?.name ?? "Deleted user"}
                    <span className="block text-xs text-ink-3">{o.customer?.email}</span>
                  </td>
                  <td className="p-3 text-ink-2">{o.items.map((i) => `${i.qty} x ${i.name}`).join(", ")}</td>
                  <td className="p-3 text-right tabular-nums">{money(o.total)}</td>
                  <td className="p-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {(NEXT[o.status] ?? []).map((n) => (
                        <button key={n} className={`btn btn-sm ${n === "cancelled" ? "btn-danger" : ""}`} disabled={saving} onClick={() => change(o.id, n)}>
                          {LABEL[n]}
                        </button>
                      ))}
                      {!NEXT[o.status] && <span className="text-ink-3">None</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span className="text-sm text-ink-2">
            Page {data.page} of {data.pages}
          </span>
          <button className="btn btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
