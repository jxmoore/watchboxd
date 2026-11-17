import { HttpError } from './http.js';
import type { TmdbRef } from './letterboxd.js';
import { getDirectLinks } from './justwatch.js';
import { searchLink } from './search-links.js';

const IMG = 'https://image.tmdb.org/t/p';

export interface Provider {
  id: number;
  name: string;
  logo: string;
  /** Where clicking the logo goes: the film on that service (direct), the service's search, or null. */
  url: string | null;
  linkKind: 'direct' | 'search' | null;
}

export interface Availability {
  link: string | null;
  free: Provider[];
  subscription: Provider[];
  rent: Provider[];
  buy: Provider[];
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
  directors: string[]; // creators for TV
  cast: string[];
  rating: number | null; // TMDB average out of 10
  votes: number;
  backdrop: string | null;
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

export async function getDetails(ref: TmdbRef, region: string): Promise<FilmDetails> {
  const ratings = ref.type === 'movie' ? 'release_dates' : 'content_ratings';
  const d = await tmdb(`/${ref.type}/${ref.id}?append_to_response=watch/providers,external_ids,credits,${ratings}`);
  const r = d['watch/providers']?.results?.[region];
  const imdb = d.imdb_id || d.external_ids?.imdb_id;
  const title: string = d.title || d.name;

  const anyProviders = r && ['free', 'ads', 'flatrate', 'rent', 'buy'].some((k) => r[k]?.length);
  const direct = anyProviders ? await getDirectLinks(ref, title, region) : new Map<string, string>();

  // Direct link for this category, else direct link for the service in any category, else the service's search.
  const slim = (cat: string, list: any[] = []): Provider[] => {
    const seen = new Set<number>();
    return list
      .filter((p) => !seen.has(p.provider_id) && seen.add(p.provider_id))
      .map((p) => {
        const url = direct.get(`${cat}:${p.provider_id}`) ?? direct.get(`*:${p.provider_id}`);
        const search = url ? null : searchLink(p.provider_name, title);
        return {
          id: p.provider_id,
          name: p.provider_name,
          logo: `${IMG}/w92${p.logo_path}`,
          url: url ?? search,
          linkKind: url ? 'direct' : search ? 'search' : null,
        };
      });
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
  const directors =
    kind === 'tv'
      ? (d.created_by ?? []).map((c: any) => c.name)
      : crew.filter((c) => c.job === 'Director').map((c) => c.name);
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
    directors: [...new Set<string>(directors)],
    cast: (d.credits?.cast ?? []).slice(0, 8).map((c: any) => c.name),
    rating: d.vote_count ? Math.round(d.vote_average * 10) / 10 : null,
    votes: d.vote_count ?? 0,
    backdrop: d.backdrop_path ? `${IMG}/w1280${d.backdrop_path}` : null,
  };
}
