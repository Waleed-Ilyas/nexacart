import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Product } from "../types";

export type CartLine = { productId: string; slug: string; name: string; price: number; image: string; qty: number; stock: number };
export type CartState = { lines: CartLine[] };

export const MAX_PER_ITEM = 10;
const KEY = "nexacart.cart.v1";

/** Reads the saved cart, ignoring anything that is not a well-formed list of lines. */
export function loadCart(storage: Pick<Storage, "getItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage): CartState {
  try {
    const raw = storage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray((parsed as { lines?: unknown } | null)?.lines)) return { lines: [] };
    const lines = (parsed as { lines: unknown[] }).lines.filter(
      (l): l is CartLine =>
        !!l &&
        typeof l === "object" &&
        typeof (l as CartLine).productId === "string" &&
        Number.isInteger((l as CartLine).qty) &&
        (l as CartLine).qty > 0 &&
        Number.isInteger((l as CartLine).price),
    );
    return { lines: lines.slice(0, 20) };
  } catch {
    return { lines: [] };
  }
}

export function saveCart(state: CartState, storage: Pick<Storage, "setItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: the cart still works for this visit */
  }
}

const limit = (stock: number) => Math.max(0, Math.min(MAX_PER_ITEM, stock));

const slice = createSlice({
  name: "cart",
  initialState: { lines: [] } as CartState,
  reducers: {
    hydrate: (_s, a: PayloadAction<CartState>) => a.payload,
    add(state, a: PayloadAction<{ product: Product; qty?: number }>) {
      const { product, qty = 1 } = a.payload;
      const max = limit(product.stock);
      if (max === 0) return;
      const line = state.lines.find((l) => l.productId === product.id);
      if (line) {
        line.qty = Math.min(max, line.qty + qty);
        line.stock = product.stock;
        line.price = product.price;
      } else {
        state.lines.push({
          productId: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          image: product.images[0]?.url ?? "",
          qty: Math.min(max, qty),
          stock: product.stock,
        });
      }
    },
    setQty(state, a: PayloadAction<{ productId: string; qty: number }>) {
      const line = state.lines.find((l) => l.productId === a.payload.productId);
      if (!line) return;
      const q = Math.floor(a.payload.qty);
      if (!Number.isFinite(q) || q < 1) return;
      line.qty = Math.min(limit(line.stock) || 1, q);
    },
    remove(state, a: PayloadAction<string>) {
      state.lines = state.lines.filter((l) => l.productId !== a.payload);
    },
    clear: () => ({ lines: [] }),
  },
});

export const { hydrate, add, setQty, remove, clear } = slice.actions;
export default slice.reducer;

export const selectCount = (s: { cart: CartState }) => s.cart.lines.reduce((n, l) => n + l.qty, 0);
export const selectSubtotal = (s: { cart: CartState }) => s.cart.lines.reduce((sum, l) => sum + l.price * l.qty, 0);
