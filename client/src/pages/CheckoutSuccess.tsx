import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { errorMessage, useConfirmCheckoutMutation, api } from "../api";
import { OrderSummary } from "../components/OrderSummary";
import { ErrorBox, Skeleton } from "../components/ui";
import { clear } from "../features/cartSlice";
import { useAppDispatch } from "../hooks";
import type { Order } from "../types";

const POLLS = 4;
const POLL_MS = 1500;

/**
 * Stripe redirects here right after payment, usually before its webhook has reached the server.
 * First wait briefly and re-read the order, since the webhook normally lands within a second or two.
 * If it is still pending, ask the server to check the Stripe session directly, so a slow webhook never leaves a paid order pending.
 */
export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const orderId = params.get("order") ?? "";
  const dispatch = useAppDispatch();
  const [confirm] = useConfirmCheckoutMutation();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      try {
        for (let i = 0; i < POLLS && !cancelled; i++) {
          const res = await dispatch(api.endpoints.order.initiate(orderId, { forceRefetch: true })).unwrap();
          if (res.order.status !== "pending") return void (!cancelled && (setOrder(res.order), dispatch(clear())));
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
        if (cancelled) return;
        const res = await confirm(orderId).unwrap();
        setOrder(res.order);
        if (res.order.status !== "pending") dispatch(clear());
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, attempt, confirm, dispatch]);

  const missing = !orderId ? "This page needs an order. Open it from the link Stripe sent you back to." : "";
  if (error || missing)
    return (
      <div className="wrap max-w-2xl py-14">
        <ErrorBox message={error || missing} onRetry={missing ? undefined : () => (setError(""), setAttempt((a) => a + 1))} />
      </div>
    );

  if (!order)
    return (
      <div className="wrap max-w-2xl py-14" role="status" aria-live="polite">
        <p className="display text-4xl">Confirming your payment…</p>
        <p className="mt-2 text-ink-2">This usually takes a second or two.</p>
        <Skeleton className="mt-6 h-32" />
      </div>
    );

  if (order.status === "pending")
    return (
      <div className="wrap max-w-2xl py-14" role="status">
        <p className="display text-4xl">We have not received your payment yet</p>
        <p className="mt-2 text-ink-2">If you completed the payment, it can take a moment to arrive. Your cart has been kept.</p>
        <div className="mt-5 flex gap-3">
          <button className="btn btn-primary" onClick={() => (setOrder(null), setAttempt((a) => a + 1))}>
            Check again
          </button>
          <Link to="/cart" className="btn">
            Back to cart
          </Link>
        </div>
      </div>
    );

  return (
    <div className="wrap max-w-2xl py-14">
      <p className="label">Order confirmed</p>
      <h1 className="display mt-2 text-5xl">Thank you.</h1>
      <p className="mt-3 text-ink-2">Your test payment went through. This is a demo, so nothing will be shipped and no money was charged.</p>
      <div className="mt-8">
        <OrderSummary order={order} />
      </div>
      <div className="mt-8 flex gap-3">
        <Link to="/orders" className="btn btn-primary">
          View my orders
        </Link>
        <Link to="/shop" className="btn">
          Keep shopping
        </Link>
      </div>
    </div>
  );
}
