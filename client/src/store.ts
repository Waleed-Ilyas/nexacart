import { configureStore } from "@reduxjs/toolkit";
import { api } from "./api";
import auth, { setSessionHint } from "./features/authSlice";
import cart, { loadCart, saveCart } from "./features/cartSlice";

export function makeStore(preloaded?: { cart: ReturnType<typeof loadCart> }) {
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer, auth, cart },
    preloadedState: preloaded,
    middleware: (getDefault) => getDefault().concat(api.middleware),
  });
  // Persist the cart whenever it changes.
  let last = store.getState().cart;
  store.subscribe(() => {
    const now = store.getState().cart;
    if (now !== last) {
      last = now;
      saveCart(now);
    }
  });
  // Remember whether this browser is signed in, so the next page load knows if a silent refresh is worth trying.
  let status = store.getState().auth.status;
  store.subscribe(() => {
    const now = store.getState().auth.status;
    if (now !== status) {
      status = now;
      if (now === "authenticated") setSessionHint(true);
      if (now === "anonymous") setSessionHint(false);
    }
  });
  return store;
}

export const store = makeStore({ cart: loadCart() });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
