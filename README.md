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
| `GET /api/trending` | This week's trending films on TMDB, dealt at random into the header before a list is loaded | 6 h |
| `GET /api/person?id=…` | Redirects to a person's IMDb page (one TMDB lookup, only when a name in the film modal is clicked) | 30 days |
| `GET /api/popular` | Letterboxd's popular lists (all time), for the "Random list" option beside the search tabs | 12 h |

- The browser loads film details six at a time, current page first, then the rest of the list in the background so filters cover everything.
- Service logos are links. Direct links to the film on each service come from JustWatch's GraphQL API (`lib/justwatch.ts`), matched by TMDB id. When there's no direct link, the logo opens that service's search for the title (`lib/search-links.ts`; the tooltip says which kind). On a sample watchlist: 77% direct, 21% search, 2% no link.
- Services are listed most widely known first: a short pinned list of household names (Netflix, Prime Video, Disney+…), then TMDB's popularity ranking for the country. Variants of one service are merged (`lib/providers.ts`): plans ("Netflix Standard with Ads"), channels sold through Amazon, Apple TV or Roku ("Shudder Amazon Channel"), free tiers and stores of the same app, and spellings ("AMC Plus" / "AMC+"). Each logo still links to wherever that offer lives. Amazon Video (rent/buy) stays separate from Prime Video.
- If Letterboxd has no TMDB id for a film (or a stale one), it falls back to a TMDB title + year search.
- The services dropdown lists every service carrying films from the list. Unchecking one hides films available only on unchecked services. Your choices are remembered in the browser across lists and visits (`src/servicePrefs.ts`): if you've unchecked more than you've kept, services you haven't seen before start unchecked too.
- Films available nowhere in your country, or that couldn't be looked up on TMDB, are hidden unless "Show unavailable" is on (remembered, like the filter, sort and page size). The "Show unavailable" switch (or the note at the end of the results) adds them back to any filter; with every service unchecked, it shows only them.
- Unavailable films that aren't out yet say so instead of "Not available": "In theaters Dec 18", "In theaters now", "Digital Mar 3", "In production" or "Announced", from TMDB's release dates for your country (`src/release.ts`). The modal lists the theatrical, digital and disc dates.
- Sort by list order, title, release date, TMDB rating or runtime. Your country, filter, sort and page size are remembered in your browser, and so is the last list you looked up: a plain visit reopens it. The address bar keeps the current list (`?u=jomo88` or `?list=…`), so you can share or bookmark it.
- "Find a film" narrows the results by title. The film modal has previous / next (and ← / →) through the current results; opening a film adds `?film=…` to the address, so it can be shared and Back closes it. Rent and buy prices (cheapest per service, from JustWatch) show under the logos in the modal.

## Caveats

- Letterboxd has no public API; this reads its HTML. If they change their markup, fix the regexes in `lib/letterboxd.ts`.
- Letterboxd sits behind Cloudflare, which may challenge requests from cloud servers. If lookups fail on Vercel but work locally, that's the cause.
- JustWatch's API is unofficial and undocumented. If it changes or blocks requests, logos quietly fall back to search links; nothing else breaks.
- Streaming data comes from JustWatch via TMDB. The credits in the header's About panel are required by TMDB's terms; keep them.
