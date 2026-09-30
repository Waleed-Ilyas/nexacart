import { formatDate, money } from "../lib/format";
import type { Order } from "../types";
import { StatusBadge } from "./ui";

export function OrderSummary({ order }: { order: Order }) {
  return (
    <article className="card p-5" aria-label={`Order ${order.id.slice(-6)}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-sm">#{order.id.slice(-8).toUpperCase()}</p>
          <p className="text-sm text-ink-3">{formatDate(order.paidAt ?? order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </header>
      <ul className="mt-4 divide-y divide-line">
        {order.items.map((i) => (
          <li key={i.productId} className="flex items-center gap-3 py-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-sunken">
              {i.image && <img src={i.image} alt="" width={56} height={56} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.name}</p>
              <p className="text-sm text-ink-3">
                {i.qty} x {money(i.price)}
              </p>
            </div>
            <p className="tabular-nums">{money(i.price * i.qty)}</p>
          </li>
        ))}
      </ul>
      <p className="flex justify-between border-t border-line pt-3 font-medium">
        <span>Total</span>
        <span className="tabular-nums">{money(order.total)}</span>
      </p>
      {order.shipping && (
        <p className="mt-3 text-sm text-ink-2">
          Ship to:{" "}
          {[order.shipping.name, order.shipping.line1, order.shipping.city, order.shipping.postalCode, order.shipping.country].filter(Boolean).join(", ")}
        </p>
      )}
    </article>
  );
}
