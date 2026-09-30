import { Link } from "react-router";
import { errorMessage, useMyOrdersQuery } from "../api";
import { OrderSummary } from "../components/OrderSummary";
import { Empty, ErrorBox, Skeleton } from "../components/ui";

export default function Orders() {
  const { data, isLoading, isError, error, refetch } = useMyOrdersQuery();
  return (
    <div className="wrap max-w-3xl py-10">
      <h1 className="display text-5xl">Your orders</h1>
      <div className="mt-8 space-y-4">
        {isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-44" />)
        ) : isError ? (
          <ErrorBox message={errorMessage(error)} onRetry={refetch} />
        ) : data!.orders.length === 0 ? (
          <Empty title="No orders yet">
            <p>When you check out, your orders will appear here.</p>
            <Link to="/shop" className="btn btn-primary mt-5">
              Start shopping
            </Link>
          </Empty>
        ) : (
          data!.orders.map((o) => <OrderSummary key={o.id} order={o} />)
        )}
      </div>
    </div>
  );
}
