# PharmaGtN — Vercel Finale Build

Dit project is geoptimaliseerd voor **Vercel** (Next.js 14, App Router). Geen extra libraries die de build breken. Stripe/API-routes zijn veilig (geven nette melding als env ontbreekt).

## Deploy stappen (simpel)
1. Upload alle bestanden uit deze repo naar je **GitHub**-repo (op **root niveau**).
2. Ga naar **Vercel → New Project → Import Git Repository** → kies je repo.
3. Laat de **defaults** staan (Vercel herkent Next.js 14 automatisch).
4. **Deploy**.

### (Optioneel) Om Stripe te activeren
Ga in Vercel naar **Project → Settings → Environment Variables** en voeg toe:
- `STRIPE_SECRET_KEY` = *je Stripe secret key* (begint met `sk_test_` of `sk_live_`)
- `NEXT_PUBLIC_STRIPE_PRICE_ID` = *Price ID* (bijv. `price_...`)
- `NEXT_PUBLIC_SITE_URL` = `https://www.pharmgtn.com` (of je Vercel URL)

Klik **Redeploy**. Test **/pricing** en **/en/pricing**.

### Routes
- Marketing NL: `/`, `/features`, `/pricing`, `/contact`
- Marketing EN: `/en`, `/en/features`, `/en/pricing`, `/en/contact`
- App landing & tools: `/app`, `/app/waterfall`, `/app/consistency`, `/app/parallel`
- API health: `/api/health`

### Styling
Tailwind is geconfigureerd (zie `globals.css`). Nav/Footers staan in `components/`.

### Waarom deze build stabiel is
- Geen externe chart-libs (placeholders), dus geen import-errors.
- Stripe-route importeert pas als env aanwezig is.
- i18n (NL/EN) is ingesteld in `next.config.js`.
- Typescript staat aan met relaxte settings (geen strict build-blockers).

Veel succes!
