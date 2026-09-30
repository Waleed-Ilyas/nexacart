import { useState } from "react";
import { Link, useParams } from "react-router";
import { errorMessage, useProductQuery } from "../api";
import { ErrorBox, Skeleton } from "../components/ui";
import { add, MAX_PER_ITEM } from "../features/cartSlice";
import { useAppDispatch, useAppSelector } from "../hooks";
import { money } from "../lib/format";

export default function ProductPage() {
  const { slug = "" } = useParams();
  const { data, isLoading, isError, error, refetch } = useProductQuery(slug);
  const dispatch = useAppDispatch();
  const inCart = useAppSelector((s) => s.cart.lines.find((l) => l.slug === slug)?.qty ?? 0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (isLoading)
    return (
      <div className="wrap grid gap-10 py-10 md:grid-cols-2" aria-busy="true">
        <Skeleton className="aspect-square" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );

  if (isError) {
    const notFound = (error as { status?: number }).status === 404;
    return (
      <div className="wrap py-16">
        {notFound ? (
          <div className="text-center">
            <p className="display text-5xl">We could not find that product</p>
            <Link to="/shop" className="btn btn-primary mt-6">
              Back to the shop
            </Link>
          </div>
        ) : (
          <ErrorBox message={errorMessage(error)} onRetry={refetch} />
        )}
      </div>
    );
  }

  const p = data!.product;
  const room = Math.max(0, Math.min(MAX_PER_ITEM, p.stock) - inCart);
  const soldOut = p.stock === 0;

  return (
    <div className="wrap py-10">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-3">
        <Link to="/shop" className="hover:text-ink">
          Shop
        </Link>{" "}
        /{" "}
        <Link to={`/shop?category=${p.category}`} className="hover:text-ink">
          {p.category}
        </Link>
      </nav>
      <div className="grid gap-10 md:grid-cols-2">
        <div className="card overflow-hidden">
          <img src={p.images[0]?.url} alt={p.name} width={900} height={900} className="aspect-square w-full object-cover" />
        </div>
        <div>
          <p className="label">{p.category}</p>
          <h1 className="display mt-2 text-5xl">{p.name}</h1>
          <p className="mt-4 text-3xl font-medium tabular-nums">{money(p.price)}</p>
          <p className="mt-5 max-w-[56ch] text-ink-2">{p.description}</p>
          <p className="mt-5 text-sm" role="status">
            {soldOut ? (
              <span className="badge bg-ink text-bg">Sold out</span>
            ) : p.stock <= 5 ? (
              <span className="badge bg-warn-soft text-warn">Only {p.stock} left</span>
            ) : (
              <span className="badge bg-ok-soft text-ok">In stock</span>
            )}
          </p>

          {!soldOut && (
            <form
              className="mt-6 flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (room === 0) return;
                dispatch(add({ product: p, qty: Math.min(qty, room) }));
                setAdded(true);
                window.setTimeout(() => setAdded(false), 2500);
              }}
            >
              <div>
                <label htmlFor="qty" className="mb-1.5 block text-sm font-medium">
                  Quantity
                </label>
                <select id="qty" className="input !w-24" value={qty} onChange={(e) => setQty(Number(e.target.value))} disabled={room === 0}>
                  {Array.from({ length: Math.max(1, room) }, (_, i) => i + 1).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" disabled={room === 0}>
                {room === 0 ? "Maximum in cart" : "Add to cart"}
              </button>
              <p aria-live="polite" className="text-sm text-ok">
                {added && (
                  <>
                    Added.{" "}
                    <Link to="/cart" className="underline underline-offset-4">
                      View cart
                    </Link>
                  </>
                )}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
