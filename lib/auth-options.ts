// lib/auth-options.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { stripe } from "@/lib/stripe";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email & Wachtwoord",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Wachtwoord", type: "password" },
      },
      async authorize(credentials) {
        const allowedEmail = (process.env.NEXTAUTH_CRED_EMAIL || "demo@pharmagtn.local").toLowerCase();
        const allowedPassword = process.env.NEXTAUTH_CRED_PASSWORD || "demo123";
        const email = String(credentials?.email || "").toLowerCase().trim();
        const password = String(credentials?.password || "");

        if (email === allowedEmail && password === allowedPassword) {
          return { id: "user-" + email, name: email.split("@")[0], email };
        }
        return null;
      },
    }),
  ],

  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;

      // Refresh Stripe status elke 10 min of bij nieuwe login
      const now = Math.floor(Date.now() / 1000);
      const checkedAt = Number((token as any).stripeCheckedAt || 0);
      const shouldRefresh = now - checkedAt > 600;

      if (shouldRefresh && token.email && process.env.STRIPE_SECRET_KEY) {
        try {
          const customers = await stripe.customers.list({ email: token.email as string, limit: 1 });
          const cust = customers.data[0];

          (token as any).stripeCustomerId = cust?.id || null;

          if (cust?.id) {
            const subs = await stripe.subscriptions.list({ customer: cust.id, status: "active", limit: 1 });
            (token as any).hasActiveSub = subs.data.length > 0;
          } else {
            (token as any).hasActiveSub = false;
          }
        } catch {
          (token as any).hasActiveSub = false;
        }
        (token as any).stripeCheckedAt = now;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).stripeCustomerId = (token as any).stripeCustomerId || null;
        (session.user as any).hasActiveSub = (token as any).hasActiveSub || false;
      }
      return session;
    },
  },
};
