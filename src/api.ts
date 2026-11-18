import type { FilmDetails, FilmInfo, Person, Provider } from '../lib/tmdb';
import type { ListFilm } from '../lib/letterboxd';

export type { FilmDetails, FilmInfo, Person, Provider, ListFilm };

export interface ListResponse {
  title: string | null;
  url: string;
  films: ListFilm[];
  truncated: boolean;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => ({ error: `Server returned ${res.status}` }));
  if (!res.ok) throw new Error(body.error ?? `Server returned ${res.status}`);
  return body as T;
}

export const fetchList = (q: string, signal?: AbortSignal) =>
  getJson<ListResponse>(`/api/list?q=${encodeURIComponent(q)}`, signal);

export const fetchTrending = (signal?: AbortSignal) =>
  getJson<{ posters: { title: string; src: string }[] }>('/api/trending', signal).then((r) => r.posters);

export interface PopularList {
  url: string;
  title: string;
  owner: string;
  count: number | null;
}
export const fetchPopular = (signal?: AbortSignal) =>
  getJson<{ lists: PopularList[] }>('/api/popular', signal).then((r) => r.lists);

// Bump when the shape of /api/film's response changes, so browsers and the CDN don't serve the old shape.
const FILM_API_VERSION = 11;

export const fetchFilm = (film: ListFilm, region: string, signal?: AbortSignal) =>
  getJson<FilmDetails>(
    `/api/film?slug=${encodeURIComponent(film.slug)}&name=${encodeURIComponent(film.name)}&region=${region}&v=${FILM_API_VERSION}`,
    signal,
  );
