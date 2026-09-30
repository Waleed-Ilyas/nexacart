import Stripe from "stripe";
import { v2 as cloudinary } from "cloudinary";
import type { Config } from "../config";
import { AppError } from "./errors";

// The API talks to Stripe and Cloudinary only through these two small interfaces.
// Production uses the real SDKs below, the tests pass in fakes, so no test touches the network.

export type CheckoutSessionInput = {
  orderId: string;
  items: { name: string; price: number; qty: number; image?: string }[];
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type ShippingDetails = { name?: string; line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string };

export type PaymentsClient = {
  createCheckoutSession(input: CheckoutSessionInput): Promise<{ id: string; url: string }>;
  retrieveSession(id: string): Promise<{ id: string; paid: boolean; shipping?: ShippingDetails }>;
  /** Verifies the Stripe signature and returns the event. Throws when it is invalid. */
  constructEvent(
    rawBody: Buffer,
    signature: string,
  ): { type: string; data: { object: { id: string; metadata?: Record<string, string> | null; payment_status?: string } & Record<string, unknown> } };
};

export type ImageStore = {
  upload(buffer: Buffer, folder: string): Promise<{ url: string; publicId: string }>;
  remove(publicId: string): Promise<void>;
};

const COUNTRIES = ["US", "CA", "GB", "AU", "DE", "FR", "NL", "AE", "IN", "PK"] as const;

function pickShipping(session: Stripe.Checkout.Session): ShippingDetails | undefined {
  // Newer API versions moved shipping under collected_information, older ones expose shipping_details.
  const s = session as unknown as {
    collected_information?: { shipping_details?: { name?: string; address?: Stripe.Address } };
    shipping_details?: { name?: string; address?: Stripe.Address };
  };
  const d = s.collected_information?.shipping_details ?? s.shipping_details;
  if (!d?.address) return undefined;
  const a = d.address;
  return {
    name: d.name ?? undefined,
    line1: a.line1 ?? undefined,
    line2: a.line2 ?? undefined,
    city: a.city ?? undefined,
    state: a.state ?? undefined,
    postalCode: a.postal_code ?? undefined,
    country: a.country ?? undefined,
  };
}

export function createStripePayments(config: Config): PaymentsClient {
  const stripe = new Stripe(config.STRIPE_SECRET_KEY);
  return {
    async createCheckoutSession(input) {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: input.customerEmail,
        client_reference_id: input.orderId,
        metadata: { orderId: input.orderId },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        shipping_address_collection: { allowed_countries: [...COUNTRIES] },
        line_items: input.items.map((i) => ({
          quantity: i.qty,
          price_data: {
            currency: "usd",
            unit_amount: i.price,
            product_data: { name: i.name, ...(i.image?.startsWith("https://") ? { images: [i.image] } : {}) },
          },
        })),
      });
      if (!session.url) throw new AppError(502, "Stripe did not return a checkout link.");
      return { id: session.id, url: session.url };
    },
    async retrieveSession(id) {
      const s = await stripe.checkout.sessions.retrieve(id);
      return { id: s.id, paid: s.payment_status === "paid", shipping: pickShipping(s) };
    },
    constructEvent(rawBody, signature) {
      return stripe.webhooks.constructEvent(rawBody, signature, config.STRIPE_WEBHOOK_SECRET) as unknown as ReturnType<PaymentsClient["constructEvent"]>;
    },
  };
}

export { pickShipping };

export function createCloudinaryStore(config: Config): ImageStore {
  cloudinary.config({ cloud_name: config.CLOUDINARY_CLOUD_NAME, api_key: config.CLOUDINARY_API_KEY, api_secret: config.CLOUDINARY_API_SECRET, secure: true });
  return {
    upload(buffer, folder) {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: "image", allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"] },
          (err, result) => {
            if (err || !result) return reject(new AppError(502, "The image could not be uploaded. Try another file."));
            resolve({ url: result.secure_url, publicId: result.public_id });
          },
        );
        stream.end(buffer);
      });
    },
    async remove(publicId) {
      if (publicId) await cloudinary.uploader.destroy(publicId);
    },
  };
}

export type Deps = { payments: PaymentsClient; images: ImageStore };
