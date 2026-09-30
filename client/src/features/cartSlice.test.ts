import { describe, expect, it } from "vitest";
import reducer, { add, clear, hydrate, loadCart, MAX_PER_ITEM, remove, saveCart, selectCount, selectSubtotal, setQty, type CartState } from "./cartSlice";
import type { Product } from "../types";

const product = (over: Partial<Product> = {}): Product => ({
  id: "p1",
  name: "Mug",
  slug: "mug",
  description: "d",
  price: 1800,
  category: "Home",
  images: [{ url: "https://img/m.png" }],
  stock: 20,
  featured: false,
  ...over,
});
const empty: CartState = { lines: [] };

describe("cart reducer", () => {
  it("adds a product and merges repeats", () => {
    let s = reducer(empty, add({ product: product() }));
    s = reducer(s, add({ product: product(), qty: 2 }));
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({ productId: "p1", qty: 3, price: 1800 });
  });

  it("never lets the quantity pass 10 or the stock", () => {
    let s = reducer(empty, add({ product: product({ stock: 50 }), qty: 99 }));
    expect(s.lines[0]!.qty).toBe(MAX_PER_ITEM);
    s = reducer(empty, add({ product: product({ stock: 3 }), qty: 5 }));
    expect(s.lines[0]!.qty).toBe(3);
    s = reducer(s, add({ product: product({ stock: 3 }), qty: 5 }));
    expect(s.lines[0]!.qty).toBe(3);
  });

  it("ignores sold-out products", () => {
    expect(reducer(empty, add({ product: product({ stock: 0 }) })).lines).toEqual([]);
  });

  it("refreshes the price when the same product is added again", () => {
    let s = reducer(empty, add({ product: product({ price: 1800 }) }));
    s = reducer(s, add({ product: product({ price: 2000 }) }));
    expect(s.lines[0]!.price).toBe(2000);
  });

  it("sets quantity within bounds and ignores nonsense", () => {
    let s = reducer(empty, add({ product: product({ stock: 4 }) }));
    s = reducer(s, setQty({ productId: "p1", qty: 3 }));
    expect(s.lines[0]!.qty).toBe(3);
    s = reducer(s, setQty({ productId: "p1", qty: 99 }));
    expect(s.lines[0]!.qty).toBe(4);
    for (const bad of [0, -2, NaN, Infinity]) expect(reducer(s, setQty({ productId: "p1", qty: bad })).lines[0]!.qty).toBe(4);
    expect(reducer(s, setQty({ productId: "missing", qty: 2 }))).toEqual(s);
  });

  it("removes and clears", () => {
    let s = reducer(empty, add({ product: product() }));
    s = reducer(s, add({ product: product({ id: "p2", name: "Lamp", slug: "lamp" }) }));
    expect(reducer(s, remove("p1")).lines.map((l) => l.productId)).toEqual(["p2"]);
    expect(reducer(s, clear())).toEqual(empty);
  });

  it("computes count and an exact subtotal in cents", () => {
    let s = reducer(empty, add({ product: product({ price: 1999 }), qty: 3 }));
    s = reducer(s, add({ product: product({ id: "p2", price: 501 }), qty: 2 }));
    const state = { cart: s };
    expect(selectCount(state)).toBe(5);
    expect(selectSubtotal(state)).toBe(1999 * 3 + 501 * 2);
  });
});

describe("cart persistence", () => {
  const store = (raw: string | null) => ({ getItem: () => raw });

  it("round-trips through storage", () => {
    const state = reducer(empty, add({ product: product(), qty: 2 }));
    const bag: Record<string, string> = {};
    saveCart(state, { setItem: (k, v) => void (bag[k] = v) });
    expect(loadCart(store(Object.values(bag)[0]!))).toEqual(state);
  });

  it("falls back to an empty cart for missing, corrupt or wrongly shaped data", () => {
    for (const raw of [null, "", "not json", "{}", '{"lines":"x"}', "[]", "null"]) expect(loadCart(store(raw)), String(raw)).toEqual(empty);
  });

  it("drops malformed lines instead of trusting them", () => {
    const good = { productId: "p1", slug: "mug", name: "Mug", price: 1800, image: "", qty: 2, stock: 5 };
    const raw = JSON.stringify({
      lines: [good, { productId: "p2", qty: -1, price: 100 }, { productId: 5, qty: 1, price: 100 }, { productId: "p3", qty: 1, price: 1.5 }, null],
    });
    expect(loadCart(store(raw)).lines).toEqual([good]);
  });

  it("survives a storage that throws", () => {
    expect(() =>
      saveCart(empty, {
        setItem: () => {
          throw new Error("quota");
        },
      }),
    ).not.toThrow();
    expect(
      loadCart({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toEqual(empty);
  });

  it("hydrate replaces the state", () => {
    const state = reducer(empty, add({ product: product() }));
    expect(reducer(empty, hydrate(state))).toEqual(state);
  });
});
