import { useState } from "react";
import { useSearchParams } from "react-router";
import { errorMessage, useProductMetaQuery, useProductsQuery } from "../api";
import { ProductCard, ProductGridSkeleton } from "../components/ProductCard";
import { Empty, ErrorBox } from "../components/ui";
import { centsToDollars, dollarsToCents } from "../lib/format";

const SORTS = [
  ["newest", "Newest"],
  ["price-asc", "Price: low to high"],
  ["price-desc", "Price: high to low"],
  ["name", "Name"],
] as const;

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const sort = params.get("sort") ?? "newest";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const minPrice = params.get("minPrice") ? Number(params.get("minPrice")) : undefined;
  const maxPrice = params.get("maxPrice") ? Number(params.get("maxPrice")) : undefined;

  const meta = useProductMetaQuery();
  const list = useProductsQuery({ q: q || undefined, category: category || undefined, sort, page, limit: 12, minPrice, maxPrice });

  // Every filter lives in the address bar, so a filtered view can be bookmarked, shared and reached with the back button.
  const update = (changes: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (resetPage) next.delete("page");
    setParams(next);
  };

  const [search, setSearch] = useState(q);
  const [min, setMin] = useState(minPrice !== undefined ? centsToDollars(minPrice) : "");
  const [max, setMax] = useState(maxPrice !== undefined ? centsToDollars(maxPrice) : "");
  const [priceError, setPriceError] = useState("");
  // Keep the search box in step with the address bar (back button, links) without an effect: adjust during render.
  const [seenQ, setSeenQ] = useState(q);
  if (q !== seenQ) {
    setSeenQ(q);
    setSearch(q);
  }

  const applyPrice = (e: React.FormEvent) => {
    e.preventDefault();
    const lo = min.trim() ? dollarsToCents(min) : undefined;
    const hi = max.trim() ? dollarsToCents(max) : undefined;
    if (lo === null || hi === null) return setPriceError("Enter prices like 25 or 25.50.");
    if (lo !== undefined && hi !== undefined && lo > hi) return setPriceError("The minimum is above the maximum.");
    setPriceError("");
    update({ minPrice: lo?.toString(), maxPrice: hi?.toString() });
  };

  const hasFilters = Boolean(q || category || minPrice !== undefined || maxPrice !== undefined);
  const clear = () => {
    setMin("");
    setMax("");
    setPriceError("");
    setParams(new URLSearchParams(sort !== "newest" ? { sort } : {}));
  };

  return (
    <div className="wrap py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Catalogue</p>
          <h1 className="display text-5xl">{category || "All products"}</h1>
        </div>
        <div>
          <label htmlFor="sort" className="sr-only">
            Sort products
          </label>
          <select id="sort" className="input !w-auto" value={sort} onChange={(e) => update({ sort: e.target.value === "newest" ? undefined : e.target.value })}>
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside aria-label="Filters" className="space-y-6">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: search.trim() || undefined });
            }}
          >
            <label htmlFor="shop-search" className="mb-1.5 block text-sm font-medium">
              Search
            </label>
            <input id="shop-search" className="input" type="search" placeholder='Try "lamp"' value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Category</legend>
            <div className="flex flex-wrap gap-2">
              <button className="chip" aria-pressed={!category} onClick={() => update({ category: undefined })}>
                All
              </button>
              {(meta.data?.categories ?? []).map((c) => (
                <button
                  key={c.name}
                  className="chip"
                  aria-pressed={category === c.name}
                  onClick={() => update({ category: category === c.name ? undefined : c.name })}
                >
                  {c.name} <span className="ml-1 opacity-60">{c.count}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <form onSubmit={applyPrice} noValidate>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Price (USD)</legend>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="min">
                  Minimum price
                </label>
                <input
                  id="min"
                  className="input"
                  inputMode="decimal"
                  placeholder="Min"
                  value={min}
                  onChange={(e) => setMin(e.target.value)}
                  aria-invalid={priceError ? true : undefined}
                  aria-describedby={priceError ? "price-error" : undefined}
                />
                <span aria-hidden>to</span>
                <label className="sr-only" htmlFor="max">
                  Maximum price
                </label>
                <input
                  id="max"
                  className="input"
                  inputMode="decimal"
                  placeholder="Max"
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                  aria-invalid={priceError ? true : undefined}
                />
              </div>
              {priceError && (
                <p id="price-error" role="alert" className="mt-1 text-[13px] text-bad">
                  {priceError}
                </p>
              )}
              <button type="submit" className="btn btn-sm mt-2">
                Apply
              </button>
            </fieldset>
          </form>

          {hasFilters && (
            <button className="text-sm underline underline-offset-4 hover:text-accent" onClick={clear}>
              Clear all filters
            </button>
          )}
        </aside>

        <section aria-label="Products" aria-live="polite">
          {list.isLoading ? (
            <ProductGridSkeleton count={8} />
          ) : list.isError ? (
            <ErrorBox message={errorMessage(list.error)} onRetry={list.refetch} />
          ) : list.data!.items.length === 0 ? (
            <Empty title="Nothing matches">
              <p>Try a different search, or widen the price range.</p>
              <button className="btn mt-4" onClick={clear}>
                Clear filters
              </button>
            </Empty>
          ) : (
            <>
              <p className="mb-4 text-sm text-ink-3">
                {list.data!.total} product{list.data!.total === 1 ? "" : "s"}
              </p>
              <div className={`grid grid-cols-2 gap-4 md:grid-cols-3 ${list.isFetching ? "opacity-60" : ""}`}>
                {list.data!.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {list.data!.pages > 1 && (
                <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
                  <button className="btn btn-sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, false)}>
                    Previous
                  </button>
                  <span className="text-sm text-ink-2">
                    Page {list.data!.page} of {list.data!.pages}
                  </span>
                  <button className="btn btn-sm" disabled={page >= list.data!.pages} onClick={() => update({ page: String(page + 1) }, false)}>
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
