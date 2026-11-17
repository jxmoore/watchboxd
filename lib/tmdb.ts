import { HttpError } from './http.js';
import type { TmdbRef } from './letterboxd.js';
import { getDirectLinks } from './justwatch.js';
import { searchLink } from './search-links.js';
import { buildCatalog, canonicalFor, type Canonical } from './providers.js';

const IMG = 'https://image.tmdb.org/t/p';

export interface Provider {
  id: number;
  name: string;
  logo: string;
  /** Where clicking the logo goes: the film on that service (direct), the service's search, or null. */
  url: string | null;
  linkKind: 'direct' | 'search' | null;
  /** Lower = more widely known (household names first, then TMDB's ranking for the country). Lists are sorted by it. */
  rank: number;
}

export interface Availability {
  link: string | null;
  free: Provider[];
  subscription: Provider[];
  rent: Provider[];
  buy: Provider[];
}

/** A credited person; the id is TMDB's, used to look up their IMDb page when clicked. */
export interface Person {
  id: number;
  name: string;
}

/** Extra details shown in the film modal. */
export interface FilmInfo {
  kind: 'movie' | 'tv';
  tagline: string | null;
  overview: string | null;
  released: string | null; // YYYY-MM-DD
  runtime: number | null; // minutes (per episode for TV)
  seasons: number | null; // TV only
  certification: string | null; // e.g. "R", "15", "TV-MA" for the region
  genres: string[];
  directors: Person[]; // creators for TV
  writers: Person[]; // screenplay / writer / story credits (films)
  cast: Person[]; // top-billed actors, in billing order
  rating: number | null; // TMDB average out of 10
  votes: number;
  backdrop: string | null;
  /** TMDB production status: "Released", "Post Production", "In Production", "Planned", "Rumored"… */
  status: string | null;
  /** Release dates in the selected country (YYYY-MM-DD), earliest of each kind. Films only. */
  dates: ReleaseDates;
}

export interface ReleaseDates {
  theatrical: string | null; // wide theatrical, or limited if that's all there is
  digital: string | null; // streaming / rent / buy
  physical: string | null; // disc
}

export interface FilmDetails {
  title: string;
  year: string;
  poster: string | null;
  posterLarge: string | null;
  tmdbUrl: string;
  imdbUrl: string | null;
  availability: Availability;
  info: FilmInfo;
}

async function tmdb<T = any>(path: string): Promise<T> {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new HttpError(500, 'TMDB_API_KEY is not set on the server.');
  const isBearer = key.length > 40; // v4 read-access token vs v3 api key
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  if (!isBearer) url.searchParams.set('api_key', key);
  const res = await fetch(url, { headers: isBearer ? { Authorization: `Bearer ${key}` } : {} });
  if (res.status === 401) throw new HttpError(500, 'TMDB rejected the API key.');
  if (res.status === 404) throw new HttpError(404, 'Not found on TMDB');
  if (res.status === 429) throw new HttpError(429, 'TMDB is rate limiting us. Try again shortly.');
  if (!res.ok) throw new HttpError(502, `TMDB returned ${res.status}`);
  return res.json() as Promise<T>;
}

export interface TrendingPoster {
  title: string;
  src: string;
}

/** This week's trending films on TMDB that have posters (about 40: two pages). */
export async function getTrendingPosters(): Promise<TrendingPoster[]> {
  const pages = await Promise.all([1, 2].map((p) => tmdb(`/trending/movie/week?page=${p}`)));
  return pages
    .flatMap((p) => p.results ?? [])
    .filter((m: any) => m.poster_path && !m.adult)
    .map((m: any) => ({ title: m.title || m.name, src: `${IMG}/w342${m.poster_path}` }));
}

/** A person's IMDb id ("nm0000621"), or null if TMDB doesn't have one. One request; used only when an actor is clicked. */
export async function getPersonImdbId(personId: string): Promise<string | null> {
  const r = await tmdb(`/person/${personId}/external_ids`);
  return r.imdb_id || null;
}

/** Fallback when Letterboxd has no TMDB id (often a film TMDB files as TV). name is "Title (Year)". */
export async function searchTmdb(name: string): Promise<TmdbRef | null> {
  const m = name.match(/^(.*?)(?:\s+\((\d{4})\))?$/)!;
  const q = encodeURIComponent(m[1]);
  const movie = await tmdb(`/search/movie?query=${q}${m[2] ? `&year=${m[2]}` : ''}`);
  if (movie.results?.[0]) return { id: String(movie.results[0].id), type: 'movie' };
  const tv = await tmdb(`/search/tv?query=${q}${m[2] ? `&first_air_date_year=${m[2]}` : ''}`);
  if (tv.results?.[0]) return { id: String(tv.results[0].id), type: 'tv' };
  return null;
}

// Each country's full list of services, used to merge variants. Fetched once per country per server instance.
const catalogs = new Map<string, Promise<Map<string, Canonical> | null>>();
function catalogFor(region: string) {
  let c = catalogs.get(region);
  if (!c) {
    c = Promise.all([
      tmdb(`/watch/providers/movie?watch_region=${region}`),
      tmdb(`/watch/providers/tv?watch_region=${region}`),
    ])
      .then(([m, t]) => buildCatalog([...(m.results ?? []), ...(t.results ?? [])], IMG, region))
      .catch(() => {
        catalogs.delete(region); // try again next time; merging still works by name meanwhile
        return null;
      });
    catalogs.set(region, c);
  }
  return c;
}

export async function getDetails(ref: TmdbRef, region: string): Promise<FilmDetails> {
  const ratings = ref.type === 'movie' ? 'release_dates' : 'content_ratings';
  const d = await tmdb(`/${ref.type}/${ref.id}?append_to_response=watch/providers,external_ids,credits,${ratings}`);
  const r = d['watch/providers']?.results?.[region];
  const imdb = d.imdb_id || d.external_ids?.imdb_id;
  const title: string = d.title || d.name;

  const anyProviders = r && ['free', 'ads', 'flatrate', 'rent', 'buy'].some((k) => r[k]?.length);
  const [direct, catalog] = anyProviders
    ? await Promise.all([getDirectLinks(ref, title, region), catalogFor(region)])
    : [new Map<string, string>(), null];

  // Each offer links to where it actually lives: a direct link for this category, else for the service in any
  // category, else that variant's search (an Amazon channel searches Amazon). Variants of one service are then
  // merged under the service's own name and logo, keeping the best link among them.
  const slim = (cat: string, list: any[] = []): Provider[] => {
    const rank = (p: Provider) => (p.linkKind === 'direct' ? 2 : p.linkKind === 'search' ? 1 : 0);
    const merged = new Map<number, Provider>();
    for (const p of list) {
      const url = direct.get(`${cat}:${p.provider_id}`) ?? direct.get(`*:${p.provider_id}`);
      const search = url ? null : searchLink(p.provider_name, title);
      const ownLogo = `${IMG}/w92${p.logo_path}`;
      const c = canonicalFor(p.provider_name, catalog, ownLogo);
      const entry: Provider = {
        id: c.id,
        name: c.name,
        logo: c.logo ?? ownLogo,
        url: url ?? search,
        linkKind: url ? 'direct' : search ? 'search' : null,
        rank: c.rank,
      };
      const cur = merged.get(c.id);
      if (!cur || rank(entry) > rank(cur)) merged.set(c.id, entry);
    }
    // Most widely known services first (Netflix, Prime Video…); niche ones last
    return [...merged.values()].sort((a, b) => a.rank - b.rank);
  };

  return {
    title,
    year: (d.release_date || d.first_air_date || '').slice(0, 4),
    poster: d.poster_path ? `${IMG}/w185${d.poster_path}` : null,
    posterLarge: d.poster_path ? `${IMG}/w780${d.poster_path}` : null,
    tmdbUrl: `https://www.themoviedb.org/${ref.type}/${ref.id}`,
    imdbUrl: imdb ? `https://www.imdb.com/title/${imdb}/` : null,
    availability: {
      link: r?.link ?? null,
      free: slim('free', [...(r?.free ?? []), ...(r?.ads ?? [])]),
      subscription: slim('subscription', r?.flatrate),
      rent: slim('rent', r?.rent),
      buy: slim('buy', r?.buy),
    },
    info: filmInfo(d, ref.type, region),
  };
}

function certificationFor(d: any, kind: 'movie' | 'tv', region: string): string | null {
  if (kind === 'tv') {
    const pick = (cc: string) => d.content_ratings?.results?.find((x: any) => x.iso_3166_1 === cc)?.rating;
    return pick(region) || pick('US') || null;
  }
  const pick = (cc: string) =>
    d.release_dates?.results
      ?.find((x: any) => x.iso_3166_1 === cc)
      ?.release_dates?.map((x: any) => x.certification)
      .find(Boolean);
  return pick(region) || pick('US') || null;
}

function filmInfo(d: any, kind: 'movie' | 'tv', region: string): FilmInfo {
  const crew: any[] = d.credits?.crew ?? [];
  // One entry per person, in credit order, at most `max`
  const people = (list: any[], max: number): Person[] => {
    const seen = new Set<number>();
    return list
      .filter((c) => c?.id && !seen.has(c.id) && seen.add(c.id))
      .slice(0, max)
      .map((c) => ({ id: c.id, name: c.name }));
  };
  const directors = kind === 'tv' ? people(d.created_by ?? [], 3) : people(crew.filter((c) => c.job === 'Director'), 3);
  const writers =
    kind === 'tv' ? [] : people(crew.filter((c) => ['Screenplay', 'Writer', 'Story', 'Screenstory'].includes(c.job)), 4);
  const runtime = kind === 'tv' ? d.episode_run_time?.[0] : d.runtime;
  return {
    kind,
    tagline: d.tagline || null,
    overview: d.overview || null,
    released: d.release_date || d.first_air_date || null,
    runtime: runtime || null,
    seasons: kind === 'tv' ? d.number_of_seasons ?? null : null,
    certification: certificationFor(d, kind, region),
    genres: (d.genres ?? []).map((g: any) => g.name),
    directors,
    writers,
    cast: people(d.credits?.cast ?? [], 8),
    rating: d.vote_count ? Math.round(d.vote_average * 10) / 10 : null,
    votes: d.vote_count ?? 0,
    backdrop: d.backdrop_path ? `${IMG}/w1280${d.backdrop_path}` : null,
    status: d.status || null,
    dates: kind === 'movie' ? releaseDatesFor(d, region) : { theatrical: null, digital: null, physical: null },
  };
}

// TMDB release types: 1 premiere, 2 limited theatrical, 3 theatrical, 4 digital, 5 physical, 6 TV
function releaseDatesFor(d: any, region: string): ReleaseDates {
  const list: { type: number; release_date: string }[] =
    d.release_dates?.results?.find((r: any) => r.iso_3166_1 === region)?.release_dates ?? [];
  const earliest = (...types: number[]) =>
    list
      .filter((r) => types.includes(r.type) && r.release_date)
      .map((r) => r.release_date.slice(0, 10))
      .sort()[0] ?? null;
  const theatrical = earliest(3) ?? earliest(2);
  const digital = earliest(4);
  const physical = earliest(5);
  // Nothing for this country: fall back to the film's main release date as its theatrical date
  if (!theatrical && !digital && !physical) return { theatrical: d.release_date || null, digital: null, physical: null };
  return { theatrical, digital, physical };
}
