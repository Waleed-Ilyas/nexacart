export type Role = "user" | "admin";
export type User = { id: string; name: string; email: string; role: Role };
export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  category: string;
  images: { url: string; publicId?: string }[];
  stock: number;
  featured: boolean;
};
export type ProductPage = { items: Product[]; total: number; page: number; pages: number };
export type ProductMeta = { categories: { name: string; count: number }[]; priceRange: { min: number; max: number } };
export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";
export type OrderItem = { productId: string; name: string; price: number; qty: number; image: string };
export type Order = {
  id: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  paidAt: string | null;
  paidVia: string | null;
  shipping: Record<string, string> | null;
  createdAt: string | null;
};
export type AdminOrder = Order & { customer: { name: string; email: string } | null };
export type Stats = {
  totals: { revenue: number; orders: number; averageOrder: number; customers: number };
  series: { date: string; revenue: number; orders: number }[];
  topProducts: { name: string; units: number; revenue: number }[];
  statuses: { status: OrderStatus; count: number }[];
  lowStock: { id: string; name: string; stock: number }[];
};
export type ProductQuery = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  page?: number;
  limit?: number;
  featured?: boolean;
};
export type ProductInput = {
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  featured: boolean;
  images: { url: string; publicId: string }[];
};
export const CATEGORIES = ["Home", "Tech", "Outdoor", "Apparel"] as const;
