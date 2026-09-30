import { Link } from "react-router";
import { useProductMetaQuery, useProductsQuery, errorMessage } from "../api";
import { ProductCard, ProductGridSkeleton } from "../components/ProductCard";
import { ErrorBox } from "../components/ui";
import { moneyWhole } from "../lib/format";

export default function Home() {
  const featured = useProductsQuery({ featured: true, limit: 4, sort: "newest" });
  const meta = useProductMetaQuery();
  const heroImages = featured.data?.items.slice(0, 3) ?? [];

  return (
    <>
      <section className="wrap grid items-center gap-10 py-14 md:py-20 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <p className="label">Demo store · MERN · Stripe test mode</p>
          <h1 className="display mt-4 text-[clamp(44px,6.4vw,84px)]">
            Everyday things, <em className="text-accent">well made</em>.
          </h1>
          <p className="mt-5 max-w-[52ch] text-lg text-ink-2">
            Twelve products across four categories. Filter them, fill a cart, and pay with a Stripe test card. The admin side has live sales charts, product
            management and order fulfilment.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop" className="btn btn-primary">
              Shop all
            </Link>
            <Link to="/login" className="btn">
              Try the demo accounts
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3" aria-hidden={heroImages.length === 0}>
          {featured.isLoading
            ? [0, 1, 2].map((i) => <div key={i} className="skeleton aspect-[3/4]" />)
            : heroImages.map((p, i) => (
                <Link
                  key={p.id}
                  to={`/product/${p.slug}`}
                  tabIndex={-1}
                  className={`overflow-hidden rounded-[14px] border border-line ${i === 1 ? "mt-8" : ""}`}
                  aria-label={p.name}
                >
                  <img src={p.images[0]?.url} alt="" width={300} height={400} className="aspect-[3/4] w-full object-cover" />
                </Link>
              ))}
        </div>
      </section>

      <section className="wrap" aria-labelledby="featured-h">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="featured-h" className="display text-4xl">
            Featured
          </h2>
          <Link to="/shop" className="text-sm underline underline-offset-4 hover:text-accent">
            See everything
          </Link>
        </div>
        {featured.isLoading ? (
          <ProductGridSkeleton count={4} />
        ) : featured.isError ? (
          <ErrorBox message={errorMessage(featured.error)} onRetry={featured.refetch} />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {featured.data!.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      <section className="wrap mt-16" aria-labelledby="cats-h">
        <h2 id="cats-h" className="display text-4xl">
          Shop by category
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {(meta.data?.categories ?? ["Home", "Tech", "Outdoor", "Apparel"].map((name) => ({ name, count: 0 }))).map((c) => (
            <li key={c.name}>
              <Link to={`/shop?category=${c.name}`} className="card block p-5 transition-colors hover:border-line-strong">
                <span className="display block text-3xl">{c.name}</span>
                <span className="mt-1 block text-sm text-ink-3">{c.count ? `${c.count} products` : "Browse"}</span>
              </Link>
            </li>
          ))}
        </ul>
        {meta.data && meta.data.priceRange.max > 0 && (
          <p className="mt-4 text-sm text-ink-3">
            Prices from {moneyWhole(meta.data.priceRange.min)} to {moneyWhole(meta.data.priceRange.max)}.
          </p>
        )}
      </section>
    </>
  );
}
