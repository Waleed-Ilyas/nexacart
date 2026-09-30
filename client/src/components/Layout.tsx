import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useLogoutMutation } from "../api";
import { signedOut } from "../features/authSlice";
import { clear, selectCount } from "../features/cartSlice";
import { useAppDispatch, useAppSelector } from "../hooks";

export const TEST_CARD = "4242 4242 4242 4242";

function DemoBanner() {
  return (
    <div className="bg-ink text-bg">
      <p className="wrap py-2 text-center text-[13px]">
        Demo store. Payments run in Stripe <strong>test mode</strong>: use card <span className="font-mono">{TEST_CARD}</span>, any future date, any CVC. No
        real money moves.
      </p>
    </div>
  );
}

export default function Layout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const count = useAppSelector(selectCount);
  const { user, status } = useAppSelector((s) => s.auth);
  const [logout] = useLogoutMutation();
  const [q, setQ] = useState("");

  const signOut = async () => {
    await logout()
      .unwrap()
      .catch(() => undefined);
    dispatch(signedOut());
    dispatch(clear());
    navigate("/");
  };

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>
      <DemoBanner />
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="wrap flex h-16 items-center gap-4 md:gap-6">
          <Link to="/" className="display text-[28px] italic" aria-label="NexaCart home">
            NexaCart
          </Link>
          <nav aria-label="Primary" className="hidden gap-5 text-sm text-ink-2 md:flex">
            <NavLink to="/shop" className={({ isActive }) => (isActive ? "text-ink" : "hover:text-ink")}>
              Shop
            </NavLink>
            {user?.role === "admin" && (
              <NavLink to="/admin" className={({ isActive }) => (isActive ? "text-ink" : "hover:text-ink")}>
                Admin
              </NavLink>
            )}
          </nav>
          <form
            role="search"
            className="ml-auto hidden max-w-xs flex-1 md:block"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/shop?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <label htmlFor="site-search" className="sr-only">
              Search products
            </label>
            <input id="site-search" className="input !min-h-10" type="search" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {status === "authenticated" ? (
              <>
                <Link to="/orders" className="btn btn-sm">
                  Orders
                </Link>
                <button className="btn btn-sm hidden sm:inline-flex" onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              status === "anonymous" && (
                <Link to="/login" className="btn btn-sm">
                  Sign in
                </Link>
              )
            )}
            <Link to="/cart" className="btn btn-primary btn-sm" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
              Cart
              <span className="rounded-full bg-bg px-1.5 text-xs font-semibold text-ink tabular-nums">{count}</span>
            </Link>
          </div>
        </div>
        <nav aria-label="Mobile" className="wrap flex gap-4 overflow-x-auto pb-2 text-sm text-ink-2 md:hidden">
          <NavLink to="/shop" className="py-1">
            Shop
          </NavLink>
          {user?.role === "admin" && (
            <NavLink to="/admin" className="py-1">
              Admin
            </NavLink>
          )}
          {status === "authenticated" && (
            <button className="py-1" onClick={signOut}>
              Sign out ({user?.name.split(" ")[0]})
            </button>
          )}
        </nav>
      </header>
      <main id="main" className="min-h-[60vh]">
        <Outlet />
      </main>
      <footer className="mt-20 border-t border-line py-10 text-sm text-ink-3">
        <div className="wrap flex flex-wrap justify-between gap-4">
          <p>NexaCart is a personal portfolio project by Waleed Ilyas. Products are fictional, orders are demo orders.</p>
          <p>
            <a
              className="underline underline-offset-4 hover:text-ink"
              href="https://github.com/Waleed-Ilyas/nexacart"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source on GitHub
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
