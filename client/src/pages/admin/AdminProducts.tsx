import { useEffect, useRef, useState } from "react";
import {
  errorMessage,
  fieldErrors,
  useAdminProductsQuery,
  useCreateProductMutation,
  useDeleteProductMutation,
  useUpdateProductMutation,
  useUploadImageMutation,
} from "../../api";
import { Empty, ErrorBox, Field, Skeleton } from "../../components/ui";
import { centsToDollars, dollarsToCents, money } from "../../lib/format";
import { CATEGORIES, type Product, type ProductInput } from "../../types";

type Draft = {
  name: string;
  description: string;
  price: string;
  category: string;
  stock: string;
  featured: boolean;
  images: { url: string; publicId: string }[];
};
const blank: Draft = { name: "", description: "", price: "", category: CATEGORIES[0], stock: "10", featured: false, images: [] };
const toDraft = (p: Product): Draft => ({
  name: p.name,
  description: p.description,
  price: centsToDollars(p.price),
  category: p.category,
  stock: String(p.stock),
  featured: p.featured,
  images: p.images.map((i) => ({ url: i.url, publicId: i.publicId ?? "" })),
});

function ProductDialog({ product, onClose }: { product: Product | "new"; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Draft>(product === "new" ? blank : toDraft(product));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [create, { isLoading: creating }] = useCreateProductMutation();
  const [update, { isLoading: updating }] = useUpdateProductMutation();
  const [upload, { isLoading: uploading }] = useUploadImageMutation();

  // The dialog is mounted only while it is open, so it starts from the product it was given and opens itself.
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    try {
      const img = await upload(file).unwrap();
      set("images", [...draft.images, img].slice(0, 5));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = dollarsToCents(draft.price);
    const stock = Number(draft.stock);
    const local: Record<string, string> = {};
    if (cents === null || cents < 1) local.price = "Enter a price like 19.99.";
    if (!Number.isInteger(stock) || stock < 0) local.stock = "Stock must be a whole number, 0 or more.";
    if (Object.keys(local).length) return setFields(local);
    const body: ProductInput = {
      name: draft.name,
      description: draft.description,
      price: cents!,
      category: draft.category,
      stock,
      featured: draft.featured,
      images: draft.images,
    };
    setFields({});
    setError("");
    try {
      if (product === "new") await create(body).unwrap();
      else if (product) await update({ id: product.id, body }).unwrap();
      onClose();
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    }
  };

  const err = (k: string) => ({ "aria-invalid": fields[k] ? true : undefined, "aria-describedby": fields[k] ? `${k}-error` : undefined }) as const;
  const busy = creating || updating;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(640px,calc(100vw-24px))] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-ink/40"
      aria-labelledby="pd-title"
    >
      <form onSubmit={submit} noValidate className="grid gap-4 p-6">
        <h2 id="pd-title" className="display text-3xl">
          {product === "new" ? "New product" : "Edit product"}
        </h2>
        <Field id="p-name" label="Name" error={fields.name}>
          <input id="p-name" className="input" value={draft.name} onChange={(e) => set("name", e.target.value)} {...err("name")} />
        </Field>
        <Field id="p-desc" label="Description" error={fields.description}>
          <textarea id="p-desc" className="input" value={draft.description} onChange={(e) => set("description", e.target.value)} {...err("description")} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field id="p-price" label="Price (USD)" error={fields.price}>
            <input id="p-price" className="input" inputMode="decimal" value={draft.price} onChange={(e) => set("price", e.target.value)} {...err("price")} />
          </Field>
          <Field id="p-stock" label="Stock" error={fields.stock}>
            <input id="p-stock" className="input" inputMode="numeric" value={draft.stock} onChange={(e) => set("stock", e.target.value)} {...err("stock")} />
          </Field>
          <Field id="p-cat" label="Category">
            <select id="p-cat" className="input" value={draft.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.featured} onChange={(e) => set("featured", e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Feature on the home page
        </label>

        <div>
          <p className="mb-1.5 text-sm font-medium">Images</p>
          <ul className="flex flex-wrap gap-2">
            {draft.images.map((img, i) => (
              <li key={img.url} className="relative">
                <img
                  src={img.url}
                  alt={`Product image ${i + 1}`}
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] rounded-lg border border-line object-cover"
                />
                <button
                  type="button"
                  className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-ink text-xs text-bg"
                  aria-label={`Remove image ${i + 1}`}
                  onClick={() =>
                    set(
                      "images",
                      draft.images.filter((_, j) => j !== i),
                    )
                  }
                >
                  x
                </button>
              </li>
            ))}
          </ul>
          <label className="btn btn-sm mt-2 cursor-pointer">
            {uploading ? "Uploading…" : "Upload image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              className="sr-only"
              disabled={uploading || draft.images.length >= 5}
              onChange={(e) => (pickImage(e.target.files?.[0]), (e.target.value = ""))}
            />
          </label>
          <p className="mt-1 text-xs text-ink-3">PNG, JPG, WebP or AVIF, up to 5 MB. Stored on Cloudinary.</p>
          {fields.images && (
            <p role="alert" className="text-[13px] text-bad">
              {fields.images}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-bad-soft p-3 text-sm text-bad">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || uploading}>
            {busy ? "Saving…" : "Save product"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function AdminProducts() {
  const { data, isLoading, isError, error, refetch } = useAdminProductsQuery();
  const [remove, { isLoading: deleting }] = useDeleteProductMutation();
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const del = async (p: Product) => {
    if (!window.confirm(`Delete "${p.name}"? Past orders keep their own copy of the details.`)) return;
    setMessage(null);
    try {
      await remove(p.id).unwrap();
      setMessage({ ok: true, text: `${p.name} deleted.` });
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) });
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className={`text-sm ${message?.ok ? "text-ok" : "text-bad"}`}>
          {message?.text}
        </p>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          New product
        </button>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : isError ? (
          <ErrorBox message={errorMessage(error)} onRetry={refetch} />
        ) : data!.products.length === 0 ? (
          <Empty title="No products yet" />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-ink-3">
                <tr>
                  <th className="p-3 font-normal">Product</th>
                  <th className="p-3 font-normal">Category</th>
                  <th className="p-3 text-right font-normal">Price</th>
                  <th className="p-3 text-right font-normal">Stock</th>
                  <th className="p-3 font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data!.products.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img src={p.images[0]?.url} alt="" width={40} height={40} className="h-10 w-10 rounded-lg bg-sunken object-cover" />
                        <span className="font-medium">{p.name}</span>
                        {p.featured && <span className="badge bg-accent-soft text-accent">Featured</span>}
                      </div>
                    </td>
                    <td className="p-3 text-ink-2">{p.category}</td>
                    <td className="p-3 text-right tabular-nums">{money(p.price)}</td>
                    <td className={`p-3 text-right tabular-nums ${p.stock <= 5 ? "font-medium text-warn" : ""}`}>{p.stock}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button className="btn btn-sm" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
                          Edit
                        </button>
                        <button className="btn btn-sm btn-danger" disabled={deleting} onClick={() => del(p)} aria-label={`Delete ${p.name}`}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && <ProductDialog key={editing === "new" ? "new" : editing.id} product={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
