# Watchboxd

Enter a Letterboxd username (or paste any public list URL) and see where each film is **free**, on a **subscription**, or for **rent / buy** in your country.

React + Vite front end, with three small serverless functions in `api/` that read Letterboxd and call TMDB. Deploys to Vercel's free tier as-is.

## Run locally

1. Put your TMDB key in `.env`: `TMDB_API_KEY=...` (free from themoviedb.org → Settings → API; either the v3 key or the v4 read token works).
2. `npm install`
3. `npm run dev` → http://localhost:5173

The dev server runs the `api/` functions itself, so you don't need the Vercel CLI locally.

## Deploy to Vercel (free)

1. Push this folder to a GitHub repo. `.env` is git-ignored, so the key won't be committed.
2. On vercel.com: **Add New → Project → Import** that repo. It detects Vite automatically; leave the build settings alone.
3. Under **Environment Variables**, add `TMDB_API_KEY` with your key, then **Deploy**.

Every push to `main` redeploys. (Or skip GitHub: `npx vercel` from this folder, then `npx vercel env add TMDB_API_KEY` and `npx vercel --prod`.)

## How it works

| Endpoint | What it does | CDN cache |
| --- | --- | --- |
| `GET /api/list?q=jomo88` | Reads every page of the Letterboxd list (username → `/watchlist/`) | 10 min |
| `GET /api/film?slug=…&name=…&region=US` | Letterboxd film page → TMDB id → title, poster, IMDb id, details for the film modal (overview, cast, runtime, rating…), streaming options | 12 h |

- The browser loads film details six at a time, current page first, then the rest of the list in the background so filters cover everything.
- Service logos are links. Direct links to the film on each service come from JustWatch's GraphQL API (`lib/justwatch.ts`), matched by TMDB id. When there's no direct link, the logo opens that service's search for the title (`lib/search-links.ts`; the tooltip says which kind). On a sample watchlist: 77% direct, 21% search, 2% no link.
- If Letterboxd has no TMDB id for a film (or a stale one), it falls back to a TMDB title + year search.
- The services dropdown lists every service carrying films from the list, all checked. Unchecking one hides films available only on unchecked services. It resets on each lookup.
- Films available nowhere in your country, or that couldn't be looked up on TMDB, are hidden by default. The "Show unavailable" switch (or the note at the end of the results) adds them back to any filter; with every service unchecked, it shows only them. It resets on each lookup.
- Sort by list order, title, release date, TMDB rating or runtime. Your country, filter, sort and page size are remembered in your browser. The address bar keeps the current list (`?u=jomo88` or `?list=…`), so you can share or bookmark it.

## Caveats

- Letterboxd has no public API; this reads its HTML. If they change their markup, fix the regexes in `lib/letterboxd.ts`.
- Letterboxd sits behind Cloudflare, which may challenge requests from cloud servers. If lookups fail on Vercel but work locally, that's the cause.
- JustWatch's API is unofficial and undocumented. If it changes or blocks requests, logos quietly fall back to search links; nothing else breaks.
- Streaming data comes from JustWatch via TMDB, and the credit in the footer is required by TMDB's terms.
