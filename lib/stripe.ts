// lib/stripe.ts
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

if (!key) {
  // Laat in dev een waarschuwing zien; in prod staan keys in Vercel env
  if (process.env.NODE_ENV !== "production") {
    console.warn("[stripe] STRIPE_SECRET_KEY ontbreekt");
  }
  // Maak een 'dummy' Stripe instantie niet aan – callers moeten dit afvangen
  // We exporteren hieronder toch een type-consistent object.
}

const _stripe = key ? new Stripe(key, { apiVersion: "2024-06-20" as any }) : (null as unknown as Stripe);

// Zorg voor 1 instantie in dev (hot reload)
export const stripe: Stripe =
  (global as any).__stripe__ || _stripe;
if (process.env.NODE_ENV !== "production") {
  (global as any).__stripe__ = stripe;
}
