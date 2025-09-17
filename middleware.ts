// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/app")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    // 1) Niet ingelogd? Naar /login (met callback)
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", pathname + search);
      return NextResponse.redirect(url);
    }

    // 2) Direct-na-betaling bypass: korte cookie die we zetten in /api/stripe/post-checkout
    const recentlyActivated = req.cookies.get("recentlyActivated")?.value === "1";
    if (recentlyActivated) {
      return NextResponse.next();
    }

    // 3) Normaal: blokkeren als geen actief abonnement
    if (!(token as any).hasActiveSub) {
      const url = req.nextUrl.clone();
      url.pathname = "/billing";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
