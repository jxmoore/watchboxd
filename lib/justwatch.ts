// Direct "watch on <service>" links from JustWatch's GraphQL API.
// This API is unofficial and undocumented: it can change or be blocked at any time, so every failure here
// is swallowed and the cards fall back to search links. JustWatch package ids are the same numbers as
// TMDB provider ids, which is how links are matched to the logos TMDB gives us.
import type { TmdbRef } from './letterboxd.js';

const ENDPOINT = 'https://apis.justwatch.com/graphql';

const QUERY = `query($f: TitleFilter!, $c: Country!, $l: Language!) {
  popularTitles(country: $c, filter: $f, first: 5) {
    edges { node {
      objectType
      content(country: $c, language: $l) { externalIds { tmdbId } }
      offers(country: $c, platform: WEB) { monetizationType standardWebURL package { packageId } }
    } }
  }
}`;

/** JustWatch monetization type → our category. */
const CAT: Record<string, string> = { FREE: 'free', ADS: 'free', FLATRATE: 'subscription', RENT: 'rent', BUY: 'buy' };

/** Returns "category:providerId" → URL, plus "*:providerId" for any category. Empty map on any failure. */
export async function getDirectLinks(ref: TmdbRef, title: string, region: string): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ query: QUERY, variables: { f: { searchQuery: title }, c: region, l: 'en' } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return links;
    const json: any = await res.json();
    const wantType = ref.type === 'tv' ? 'SHOW' : 'MOVIE';
    const node = json?.data?.popularTitles?.edges
      ?.map((e: any) => e.node)
      .find((n: any) => n?.objectType === wantType && String(n?.content?.externalIds?.tmdbId) === ref.id);
    for (const o of node?.offers ?? []) {
      const id = o?.package?.packageId;
      const url = o?.standardWebURL;
      if (!id || typeof url !== 'string' || !/^https:\/\//.test(url)) continue;
      const cat = CAT[o.monetizationType];
      if (cat && !links.has(`${cat}:${id}`)) links.set(`${cat}:${id}`, url);
      if (!links.has(`*:${id}`)) links.set(`*:${id}`, url);
    }
  } catch {
    /* unofficial API: ignore and fall back */
  }
  return links;
}
