import { lazy, Suspense, useEffect } from "react";
import { Link, Route, Routes } from "react-router";
import { refreshSession } from "./api";
import Guards from "./components/GuardsRoutes";
import Layout from "./components/Layout";
import { Skeleton } from "./components/ui";
import { hasSessionHint, signedOut } from "./features/authSlice";
import { useAppDispatch } from "./hooks";
import Cart from "./pages/Cart";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import Home from "./pages/Home";
import { Login, Register } from "./pages/Auth";
import Orders from "./pages/Orders";
import ProductPage from "./pages/ProductPage";
import Shop from "./pages/Shop";

// Charts are only needed by admins, so the admin area is loaded on demand and stays out of the storefront bundle.
const Admin = lazy(() => import("./pages/admin/Admin"));

function NotFound() {
  return (
    <div className="wrap py-24 text-center">
      <p className="display text-6xl">Page not found</p>
      <p className="mt-3 text-ink-2">That page does not exist or has moved.</p>
      <Link to="/shop" className="btn btn-primary mt-6">
        Keep shopping
      </Link>
    </div>
  );
}

export default function App() {
  const dispatch = useAppDispatch();

  // On page load, quietly restore the session from the refresh cookie, but only if this browser had one.
  useEffect(() => {
    if (!hasSessionHint()) {
      dispatch(signedOut());
      return;
    }
    refreshSession(dispatch).then((ok) => {
      if (!ok) dispatch(signedOut());
    });
  }, [dispatch]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="shop" element={<Shop />} />
        <Route path="product/:slug" element={<ProductPage />} />
        <Route path="cart" element={<Cart />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route
          path="checkout/success"
          element={
            <Guards.Auth>
              <CheckoutSuccess />
            </Guards.Auth>
          }
        />
        <Route
          path="orders"
          element={
            <Guards.Auth>
              <Orders />
            </Guards.Auth>
          }
        />
        <Route
          path="admin/*"
          element={
            <Guards.Admin>
              <Suspense
                fallback={
                  <div className="wrap py-12">
                    <Skeleton className="h-10 w-64" />
                  </div>
                }
              >
                <Admin />
              </Suspense>
            </Guards.Admin>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
