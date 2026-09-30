import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { setSession, signedOut } from "./features/authSlice";
import type { AdminOrder, Order, Product, ProductInput, ProductMeta, ProductPage, ProductQuery, Stats, User } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;

type AuthState = { auth: { accessToken: string | null } };
const raw = fetchBaseQuery({
  baseUrl: BASE,
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as AuthState).auth.accessToken;
    if (token) headers.set("authorization", `Bearer ${token}`);
    return headers;
  },
});

type Session = { user: User; accessToken: string };
let refreshing: Promise<boolean> | null = null;

/** Trades the refresh cookie for a new access token. One request is shared if several fail at once. */
export function refreshSession(dispatch: (a: unknown) => unknown): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    .then(async (res) => {
      if (!res.ok) return false;
      dispatch(setSession((await res.json()) as Session));
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

const isAuthCall = (args: string | FetchArgs) => (typeof args === "string" ? args : args.url).startsWith("/auth/");

// A 401 on a normal request means the 15 minute access token expired: refresh once, then retry the request.
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extra) => {
  let result = await raw(args, api, extra);
  if (result.error?.status === 401 && !isAuthCall(args)) {
    if (await refreshSession(api.dispatch)) result = await raw(args, api, extra);
    else api.dispatch(signedOut());
  }
  return result;
};

export type ApiError = { error: string; fields?: Record<string, string> };
/** Turns whatever RTK Query returns into one readable message. */
export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const err = e as { status?: number | string; data?: Partial<ApiError> } | undefined;
  if (err?.data?.error) return err.data.error;
  if (err?.status === "FETCH_ERROR") return "Could not reach the server. Check your connection and try again.";
  return fallback;
}
export const fieldErrors = (e: unknown): Record<string, string> => (e as { data?: ApiError })?.data?.fields ?? {};

const qs = (q: ProductQuery) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "" && v !== false) p.set(k, String(v));
  return p.toString();
};

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["Products", "Orders", "AdminProducts", "AdminOrders", "Stats"],
  endpoints: (b) => ({
    products: b.query<ProductPage, ProductQuery>({ query: (q) => `/products?${qs(q)}`, providesTags: ["Products"] }),
    productMeta: b.query<ProductMeta, void>({ query: () => "/products/meta", providesTags: ["Products"] }),
    product: b.query<{ product: Product }, string>({ query: (slug) => `/products/${encodeURIComponent(slug)}`, providesTags: ["Products"] }),

    login: b.mutation<Session, { email: string; password: string }>({ query: (body) => ({ url: "/auth/login", method: "POST", body }) }),
    register: b.mutation<Session, { name: string; email: string; password: string }>({ query: (body) => ({ url: "/auth/register", method: "POST", body }) }),
    logout: b.mutation<{ ok: true }, void>({ query: () => ({ url: "/auth/logout", method: "POST" }) }),

    createCheckout: b.mutation<{ url: string; orderId: string }, { items: { productId: string; qty: number }[] }>({
      query: (body) => ({ url: "/checkout", method: "POST", body }),
    }),
    confirmCheckout: b.mutation<{ order: Order }, string>({
      query: (orderId) => ({ url: "/checkout/confirm", method: "POST", body: { orderId } }),
      invalidatesTags: ["Orders", "Products"],
    }),
    myOrders: b.query<{ orders: Order[] }, void>({ query: () => "/orders/mine", providesTags: ["Orders"] }),
    order: b.query<{ order: Order }, string>({ query: (id) => `/orders/${id}`, providesTags: ["Orders"] }),

    adminStats: b.query<Stats, void>({ query: () => "/admin/stats", providesTags: ["Stats"] }),
    adminOrders: b.query<{ orders: AdminOrder[]; total: number; page: number; pages: number }, { status?: string; page: number }>({
      query: (q) => `/admin/orders?${qs(q)}`,
      providesTags: ["AdminOrders"],
    }),
    setOrderStatus: b.mutation<{ order: Order }, { id: string; status: "shipped" | "delivered" | "cancelled" }>({
      query: ({ id, status }) => ({ url: `/admin/orders/${id}`, method: "PATCH", body: { status } }),
      invalidatesTags: ["AdminOrders", "Stats", "AdminProducts", "Products"],
    }),
    adminProducts: b.query<{ products: Product[] }, void>({ query: () => "/admin/products", providesTags: ["AdminProducts"] }),
    createProduct: b.mutation<{ product: Product }, ProductInput>({
      query: (body) => ({ url: "/admin/products", method: "POST", body }),
      invalidatesTags: ["AdminProducts", "Products", "Stats"],
    }),
    updateProduct: b.mutation<{ product: Product }, { id: string; body: ProductInput }>({
      query: ({ id, body }) => ({ url: `/admin/products/${id}`, method: "PUT", body }),
      invalidatesTags: ["AdminProducts", "Products", "Stats"],
    }),
    deleteProduct: b.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/admin/products/${id}`, method: "DELETE" }),
      invalidatesTags: ["AdminProducts", "Products", "Stats"],
    }),
    uploadImage: b.mutation<{ url: string; publicId: string }, File>({
      query: (file) => {
        const body = new FormData();
        body.append("image", file);
        return { url: "/admin/uploads", method: "POST", body };
      },
    }),
  }),
});

export const {
  useProductsQuery,
  useProductMetaQuery,
  useProductQuery,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useCreateCheckoutMutation,
  useConfirmCheckoutMutation,
  useMyOrdersQuery,
  useOrderQuery,
  useAdminStatsQuery,
  useAdminOrdersQuery,
  useSetOrderStatusMutation,
  useAdminProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useUploadImageMutation,
} = api;
