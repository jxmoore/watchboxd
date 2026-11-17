// Folding TMDB's many variants of one service into a single entry.
// TMDB lists plans ("Netflix Standard with Ads"), channels sold through another store ("Shudder Amazon Channel",
// "AMC Plus Apple TV channel", "AMC+ Roku Premium Channel"), free tiers ("YouTube Free"), stores of the same app
// ("Apple TV Store") and spelling variants ("Discovery +") as separate services.

export interface Canonical {
  id: number;
  name: string;
  logo: string | null; // full URL, or null to keep the variant's own logo
  rank: number; // lower = more widely known; logos are listed in this order
}

/**
 * Household names first, in this order (service keys, see serviceKey). TMDB's own popularity ranking is mostly
 * sensible but has odd gaps (Tubi below Xumo, HBO Max below Fawesome in the US), so the big ones are pinned here and
 * everything else follows TMDB's ranking for the country.
 */
const HOUSEHOLD = [
  'netflix', 'amazon prime video', 'disney+', 'max', 'hulu', 'apple tv', 'paramount+', 'peacock',
  'tubi tv', 'pluto tv', 'the roku channel', 'youtube', 'amazon video', 'google play movies', 'fandango at home',
];
const UNRANKED = 100_000;
export function rankFor(key: string, tmdbPriority: number | undefined): number {
  const i = HOUSEHOLD.indexOf(key);
  if (i >= 0) return i;
  return 1_000 + (tmdbPriority ?? UNRANKED);
}

// Whole-name aliases, applied after the suffixes below are stripped (lowercase keys).
const ALIASES: Record<string, string> = {
  'apple tv store': 'apple tv',
  'justwatch tv store': 'justwatch tv',
  'hbo max': 'max', // TMDB has used both names
};
const PLAIN_ALIASES = new Set(['hbo max']); // aliases that are a service's real name, not a variant of it

/** A lowercase key shared by every variant of a service: "AMC Plus Apple TV channel" → "amc+". */
export function serviceKey(name: string): string {
  let k = name.toLowerCase().trim();
  k = k.replace(/\s+(amazon channel|apple tv channel|roku premium channel)$/, '');
  k = k.replace(/\s+(free with ads|(standard |basic |premium )?with ads)$/, '');
  k = k.replace(/\s+(essential|premium|kids)$/, '');
  k = k.replace(/\s+free$/, '');
  k = k.replace(/\s+plus$/, '+').replace(/\s+\+$/, '+'); // "Paramount Plus" / "Discovery +" → "paramount+" / "discovery+"
  k = ALIASES[k] ?? k;
  return k;
}

/** Stable numeric id for a key we have no TMDB provider for (FNV-1a, kept clear of TMDB's small ids). */
function hashId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return 10_000_000 + ((h >>> 0) % 1_000_000_000);
}

/**
 * Builds the key → canonical service map from a region's full provider list (TMDB /watch/providers/movie).
 * The canonical entry is the variant whose own name is the plain service name (e.g. "Shudder", not "Shudder Amazon
 * Channel"); if there isn't one, the highest-priority variant.
 */
type CatalogEntry = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority?: number;
  display_priorities?: Record<string, number>; // per country
};

export function buildCatalog(list: CatalogEntry[], img: string, region: string) {
  const prio = (p: CatalogEntry) => p.display_priorities?.[region] ?? p.display_priority ?? UNRANKED;
  const best = new Map<string, { p: CatalogEntry; plain: boolean; top: number }>();
  for (const p of list) {
    const key = serviceKey(p.provider_name);
    const lower = p.provider_name.toLowerCase();
    const plain = lower.replace(/\s+plus$/, '+').replace(/\s+\+$/, '+') === key || PLAIN_ALIASES.has(lower);
    const cur = best.get(key);
    const top = Math.min(prio(p), cur?.top ?? UNRANKED); // a service ranks as well as its best-ranked variant
    const better = !cur || (plain && !cur.plain) || (plain === cur.plain && prio(p) < prio(cur.p));
    best.set(key, better ? { p, plain, top } : { ...cur!, top });
  }
  const out = new Map<string, Canonical>();
  for (const [key, { p, plain, top }] of best) {
    out.set(key, {
      id: p.provider_id,
      name: plain ? p.provider_name : tidyName(p.provider_name),
      logo: `${img}/w92${p.logo_path}`,
      rank: rankFor(key, top),
    });
  }
  return out;
}

/**
 * When a service has no plain-named entry, drop plan and tier words from the one we picked ("Paramount Plus Premium"
 * → "Paramount Plus"). Channel suffixes stay: "Screambox Amazon Channel" really is only available through Amazon.
 */
function tidyName(name: string): string {
  return name
    .replace(/\s+(free with ads|(standard |basic |premium )?with ads)$/i, '')
    .replace(/\s+(essential|premium|kids|free|store)$/i, '');
}

/** Canonical service for a variant, falling back to the variant itself (with a key-based id) if it's not in the catalog. */
export function canonicalFor(name: string, catalog: Map<string, Canonical> | null, fallbackLogo: string): Canonical {
  const key = serviceKey(name);
  const hit = catalog?.get(key);
  if (hit) return hit;
  return { id: hashId(key), name, logo: fallbackLogo, rank: rankFor(key, undefined) };
}
