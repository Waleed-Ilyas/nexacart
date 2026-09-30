const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Prices travel as integer cents everywhere. This is the only place they become dollars. */
export const money = (cents: number) => usd.format(cents / 100);
export const moneyWhole = (cents: number) => usdWhole.format(cents / 100);

/** "19.99" or "19" to cents, or null when the text is not a valid non-negative amount. Exact, no floating point. */
export function dollarsToCents(input: string): number | null {
  const v = input.trim().replace(/^\$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const [whole = "0", frac = ""] = v.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export const centsToDollars = (cents: number) => (cents / 100).toFixed(2);

const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
export const formatDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "");
