import { NavLink, Route, Routes } from "react-router";
import AdminOrders from "./AdminOrders";
import AdminProducts from "./AdminProducts";
import Overview from "./Overview";

const TABS = [
  ["/admin", "Overview", true],
  ["/admin/products", "Products", false],
  ["/admin/orders", "Orders", false],
] as const;

export default function Admin() {
  return (
    <div className="wrap py-10">
      <p className="label">Admin</p>
      <h1 className="display text-5xl">Store dashboard</h1>
      <nav aria-label="Admin sections" className="mt-6 flex gap-2 border-b border-line pb-3">
        {TABS.map(([to, label, end]) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `rounded-full px-4 py-1.5 text-sm font-medium ${isActive ? "bg-ink text-bg" : "text-ink-2 hover:bg-sunken"}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-8">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
        </Routes>
      </div>
    </div>
  );
}
