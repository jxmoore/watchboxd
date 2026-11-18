// Direct "watch on <service>" links and rent/buy prices from JustWatch's GraphQL API.
// This API is unofficial and undocumented: it can change or be blocked at any time, so every failure here
// is swallowed and the site falls back to search links and no prices. JustWatch package ids are the same numbers as
// TMDB provider ids, which is how links and prices are matched to the logos TMDB gives us.
import type { TmdbRef } from './letterboxd.js';

const ENDPOINT = 'https://apis.justwatch.com/graphql';

const QUERY = `query($f: TitleFilter!, $c: Country!, $l: Language!) {
  popularTitles(country: $c, filter: $f, first: 5) {
    edges { node {
      objectType
      content(country: $c, language: $l) { externalIds { tmdbId } }
      offers(country: $c, platform: WEB) {
        monetizationType standardWebURL retailPrice(language: $l) retailPriceValue package { packageId }
      }
    } }
  }
}`;

/** JustWatch monetization type → our category. */
const CAT: Record<string, string> = { FREE: 'free', ADS: 'free', FLATRATE: 'subscription', RENT: 'rent', BUY: 'buy' };

export interface Price {
  text: string; // formatted for the country, e.g. "$3.99"
  value: number;
}

export interface Offers {
  /** "category:providerId" → URL, plus "*:providerId" for any category */
  links: Map<string, string>;
  /** "rent:providerId" / "buy:providerId" → cheapest price across qualities (SD, HD, 4K) */
  prices: Map<string, Price>;
}

export async function getOffers(ref: TmdbRef, title: string, region: string): Promise<Offers> {
  const links = new Map<string, string>();
  const prices = new Map<string, Price>();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ query: QUERY, variables: { f: { searchQuery: title }, c: region, l: 'en' } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { links, prices };
    const json: any = await res.json();
    const wantType = ref.type === 'tv' ? 'SHOW' : 'MOVIE';
    const node = json?.data?.popularTitles?.edges
      ?.map((e: any) => e.node)
      .find((n: any) => n?.objectType === wantType && String(n?.content?.externalIds?.tmdbId) === ref.id);
    for (const o of node?.offers ?? []) {
      const id = o?.package?.packageId;
      if (!id) continue;
      const cat = CAT[o.monetizationType];
      const url = o?.standardWebURL;
      if (typeof url === 'string' && /^https:\/\//.test(url)) {
        if (cat && !links.has(`${cat}:${id}`)) links.set(`${cat}:${id}`, url);
        if (!links.has(`*:${id}`)) links.set(`*:${id}`, url);
      }
      const value = Number(o?.retailPriceValue);
      if ((cat === 'rent' || cat === 'buy') && typeof o?.retailPrice === 'string' && value > 0) {
        const key = `${cat}:${id}`;
        const cur = prices.get(key);
        if (!cur || value < cur.value) prices.set(key, { text: o.retailPrice, value });
      }
    }
  } catch {
    /* unofficial API: ignore and fall back */
  }
  return { links, prices };
}
