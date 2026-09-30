import { Link } from "react-router";
import { add } from "../features/cartSlice";
import { useAppDispatch } from "../hooks";
import { money } from "../lib/format";
import type { Product } from "../types";

export function ProductCard({ product }: { product: Product }) {
  const dispatch = useAppDispatch();
  const soldOut = product.stock === 0;
  const image = product.images[0]?.url;
  return (
    <article className="card group flex flex-col overflow-hidden">
      <Link
        to={`/product/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-sunken"
        aria-label={`${product.name}, ${money(product.price)}`}
      >
        {image && (
          <img
            src={image}
            alt=""
            width={600}
            height={600}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
        {soldOut && <span className="badge absolute left-3 top-3 bg-ink text-bg">Sold out</span>}
        {!soldOut && product.stock <= 5 && <span className="badge absolute left-3 top-3 bg-warn-soft text-warn">Only {product.stock} left</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="label">{product.category}</p>
        <h3 className="text-[17px] font-medium leading-snug">
          <Link to={`/product/${product.slug}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <p className="text-[17px] font-medium tabular-nums">{money(product.price)}</p>
          <button className="btn btn-sm" disabled={soldOut} onClick={() => dispatch(add({ product }))} aria-label={`Add ${product.name} to cart`}>
            {soldOut ? "Sold out" : "Add"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="skeleton aspect-square rounded-none" />
          <div className="space-y-2 p-4">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-5 w-3/4" />
            <div className="skeleton h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
