import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { errorMessage, useCreateCheckoutMutation } from "../api";
import { Empty, ErrorBox } from "../components/ui";
import { remove, selectSubtotal, setQty } from "../features/cartSlice";
import { useAppDispatch, useAppSelector } from "../hooks";
import { money } from "../lib/format";

export default function Cart() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const lines = useAppSelector((s) => s.cart.lines);
  const subtotal = useAppSelector(selectSubtotal);
  const status = useAppSelector((s) => s.auth.status);
  const [createCheckout, { isLoading }] = useCreateCheckoutMutation();
  const [error, setError] = useState("");

  const checkout = async () => {
    setError("");
    if (status !== "authenticated") return navigate("/login", { state: { from: "/cart" } });
    try {
      // Only ids and quantities leave the browser. The server looks up the real prices.
      const { url } = await createCheckout({ items: lines.map((l) => ({ productId: l.productId, qty: l.qty })) }).unwrap();
      window.location.assign(url);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (lines.length === 0)
    return (
      <div className="wrap py-16">
        <Empty title="Your cart is empty">
          <p>Add a few things and they will show up here.</p>
          <Link to="/shop" className="btn btn-primary mt-5">
            Browse the shop
          </Link>
        </Empty>
      </div>
    );

  return (
    <div className="wrap py-10">
      <h1 className="display text-5xl">Your cart</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <ul className="space-y-3">
          {lines.map((l) => (
            <li key={l.productId} className="card flex gap-4 p-4">
              <Link to={`/product/${l.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-[10px] bg-sunken">
                {l.image && <img src={l.image} alt="" width={96} height={96} className="h-full w-full object-cover" />}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link to={`/product/${l.slug}`} className="font-medium hover:underline">
                  {l.name}
                </Link>
                <p className="text-sm text-ink-3">{money(l.price)} each</p>
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                  <label className="sr-only" htmlFor={`q-${l.productId}`}>
                    Quantity for {l.name}
                  </label>
                  <select
                    id={`q-${l.productId}`}
                    className="input !w-20 !min-h-9"
                    value={l.qty}
                    onChange={(e) => dispatch(setQty({ productId: l.productId, qty: Number(e.target.value) }))}
                  >
                    {Array.from({ length: Math.max(1, Math.min(10, l.stock)) }, (_, i) => i + 1).map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                  <button
                    className="text-sm text-ink-3 underline underline-offset-4 hover:text-bad"
                    onClick={() => dispatch(remove(l.productId))}
                    aria-label={`Remove ${l.name}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="font-medium tabular-nums">{money(l.price * l.qty)}</p>
            </li>
          ))}
        </ul>

        <aside className="card h-fit p-5" aria-label="Order summary">
          <h2 className="text-lg font-medium">Summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-2">Subtotal</dt>
              <dd className="tabular-nums">{money(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Shipping</dt>
              <dd>Free (demo)</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(subtotal)}</dd>
            </div>
          </dl>
          <button className="btn btn-primary mt-5 w-full" onClick={checkout} disabled={isLoading}>
            {isLoading ? "Preparing checkout…" : status === "authenticated" ? "Checkout with Stripe" : "Sign in to check out"}
          </button>
          <p className="mt-3 text-xs text-ink-3">You will pay on Stripe&apos;s hosted page in test mode. Card 4242 4242 4242 4242, any future date and CVC.</p>
          {error && (
            <div className="mt-4">
              <ErrorBox message={error} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
