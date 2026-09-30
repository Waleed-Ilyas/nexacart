import { describe, expect, it } from "vitest";
import { api, bearer, signInAdmin, useTestApp } from "./helpers";

// The public demo publishes the admin login, so product changes are switched off for that one account.
const t = useTestApp({ DEMO_ADMIN_READONLY: "true", DEMO_ADMIN_EMAIL: "demo-admin@example.com" });

const body = { name: "Ceramic Mug", description: "A stoneware mug for daily coffee.", price: 1800, category: "Home", stock: 10, featured: false, images: [] };

describe("read-only demo admin", () => {
  it("can read everything and change order status, but not products or uploads", async () => {
    const demo = await signInAdmin(t.app, "demo-admin@example.com");
    const h = bearer(demo.token);
    expect((await api(t.app).get("/api/admin/stats").set(h)).status).toBe(200);
    expect((await api(t.app).get("/api/admin/products").set(h)).status).toBe(200);
    const create = await api(t.app).post("/api/admin/products").set(h).send(body);
    expect(create.status).toBe(403);
    expect(create.body.code).toBe("demo_readonly");
    expect((await api(t.app).put("/api/admin/products/64b7f0f0f0f0f0f0f0f0f0f0").set(h).send(body)).status).toBe(403);
    expect((await api(t.app).delete("/api/admin/products/64b7f0f0f0f0f0f0f0f0f0f0").set(h)).status).toBe(403);
    expect((await api(t.app).post("/api/admin/uploads").set(h)).status).toBe(403);
  });

  it("does not restrict a real admin", async () => {
    const boss = await signInAdmin(t.app, "boss@example.com");
    expect((await api(t.app).post("/api/admin/products").set(bearer(boss.token)).send(body)).status).toBe(201);
  });
});
