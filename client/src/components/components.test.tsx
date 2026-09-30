import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { makeStore } from "../store";
import type { Product } from "../types";
import { RequireAdmin, RequireAuth } from "./Guards";
import { ProductCard } from "./ProductCard";
import { setSession, signedOut } from "../features/authSlice";

const product = (over: Partial<Product> = {}): Product => ({
  id: "p1",
  name: "Stoneware Mug",
  slug: "stoneware-mug",
  description: "d",
  price: 1800,
  category: "Home",
  images: [{ url: "https://img/m.png" }],
  stock: 20,
  featured: false,
  ...over,
});
const emptyCart = { cart: { lines: [] } };

function renderWithStore(ui: React.ReactNode, store = makeStore(emptyCart), path = "/") {
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </Provider>,
    ),
  };
}

describe("ProductCard", () => {
  it("shows the name, category and price, and adds to the cart", async () => {
    const { store } = renderWithStore(<ProductCard product={product()} />);
    expect(screen.getByRole("heading", { name: "Stoneware Mug" })).toBeInTheDocument();
    expect(screen.getByText("$18.00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add Stoneware Mug to cart" }));
    expect(store.getState().cart.lines).toMatchObject([{ productId: "p1", qty: 1, price: 1800 }]);
  });

  it("disables the button and says so when sold out", () => {
    renderWithStore(<ProductCard product={product({ stock: 0 })} />);
    expect(screen.getAllByText("Sold out").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Add Stoneware Mug to cart/ })).toBeDisabled();
  });

  it("warns when only a few are left", () => {
    renderWithStore(<ProductCard product={product({ stock: 3 })} />);
    expect(screen.getByText("Only 3 left")).toBeInTheDocument();
  });
});

describe("route guards", () => {
  const routes = (
    <Routes>
      <Route path="/login" element={<p>Login page</p>} />
      <Route
        path="/private"
        element={
          <RequireAuth>
            <p>Secret</p>
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <p>Admin area</p>
          </RequireAdmin>
        }
      />
    </Routes>
  );

  it("sends anonymous visitors to sign in", () => {
    const store = makeStore(emptyCart);
    store.dispatch(signedOut());
    renderWithStore(routes, store, "/private");
    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });

  it("shows a loading state, not a redirect, while the session is being restored", () => {
    renderWithStore(routes, makeStore(emptyCart), "/private");
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });

  it("lets a signed-in customer into private pages but not the admin area", () => {
    const store = makeStore(emptyCart);
    store.dispatch(setSession({ user: { id: "u", name: "A", email: "a@x.io", role: "user" }, accessToken: "t" }));
    const { unmount } = renderWithStore(routes, store, "/private");
    expect(screen.getByText("Secret")).toBeInTheDocument();
    unmount();
    renderWithStore(routes, store, "/admin");
    expect(screen.getByText("Admins only")).toBeInTheDocument();
    expect(screen.queryByText("Admin area")).not.toBeInTheDocument();
  });

  it("lets an admin in", () => {
    const store = makeStore(emptyCart);
    store.dispatch(setSession({ user: { id: "u", name: "A", email: "a@x.io", role: "admin" }, accessToken: "t" }));
    renderWithStore(routes, store, "/admin");
    expect(screen.getByText("Admin area")).toBeInTheDocument();
  });
});
