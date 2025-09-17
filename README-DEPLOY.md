# PharmaGtN — Bilingual Marketing Frontend (Vercel-ready)

## Deploy in 3 stappen
1) **Upload** alle bestanden naar de root van je GitHub-repo (geen extra mapniveau).
2) **Vercel → New Project → Import Repository** → kies de repo → zet alles op **default** → **Deploy**.
3) Ga naar `https://<project>.vercel.app` en test NL (`/`) en EN (`/en`).

## Wat zit erin?
- Next.js 14 (App Router) + Tailwind
- NL & EN content (SEO-vriendelijk), responsive UI
- Dummy visuals (SVG) in `/public/images` voor hero, waterfall, scatter, heatmap
- Health endpoint: `/api/health`

## Aanpassen visuals
Vervang de SVG's in `public/images/` door eigen grafieken/illustraties (zelfde bestandsnamen).

## Domain & SEO
- Koppel een custom domain in Vercel (Project → Settings → Domains).
- Voeg in Vercel → Project → Settings → Analytics & Head metadata indien gewenst.
