import type { ListFilm } from './api';
import type { DetailEntry } from './useFilmDetails';

export type Sort = 'list' | 'az' | 'za' | 'newest' | 'oldest' | 'rating' | 'shortest' | 'longest';

export const SORT_OPTIONS: [Sort, string][] = [
  ['list', 'List order'],
  ['az', 'Title A–Z'],
  ['za', 'Title Z–A'],
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['rating', 'Highest rated'],
  ['shortest', 'Shortest first'],
  ['longest', 'Longest first'],
];

/** Sorts that need TMDB data, so the order settles only once everything has loaded. */
export const NEEDS_DETAILS: Sort[] = ['rating', 'shortest', 'longest'];

type Details = Record<string, DetailEntry>;

const data = (f: ListFilm, details: Details) => {
  const e = details[f.slug];
  return e?.ok ? e.data : null;
};

// Like Letterboxd: ignore a leading "The", "A" or "An".
const sortTitle = (f: ListFilm, details: Details) =>
  (data(f, details)?.title ?? f.name.replace(/\s+\(\d{4}\)$/, '')).replace(/^(the|a|an)\s+/i, '');

// Full release date when TMDB has it, else the year from Letterboxd's "Title (Year)".
const released = (f: ListFilm, details: Details) =>
  data(f, details)?.info.released || data(f, details)?.year || f.name.match(/\((\d{4})\)$/)?.[1] || null;

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Missing values always sort last, whichever direction. Ties keep list order. */
function by<T>(films: ListFilm[], key: (f: ListFilm) => T | null | undefined, cmp: (a: T, b: T) => number) {
  const keyed = films.map((f, i) => ({ f, i, k: key(f) ?? null }));
  keyed.sort((a, b) => {
    if (a.k === null || b.k === null) return a.k === null ? (b.k === null ? a.i - b.i : 1) : -1;
    return cmp(a.k, b.k) || a.i - b.i;
  });
  return keyed.map((x) => x.f);
}

export function sortFilms(films: ListFilm[], sort: Sort, details: Details): ListFilm[] {
  switch (sort) {
    case 'list':
      return films;
    case 'az':
      return by(films, (f) => sortTitle(f, details), collator.compare);
    case 'za':
      return by(films, (f) => sortTitle(f, details), (a, b) => collator.compare(b, a));
    case 'newest':
      return by(films, (f) => released(f, details), (a, b) => b.localeCompare(a));
    case 'oldest':
      return by(films, (f) => released(f, details), (a, b) => a.localeCompare(b));
    case 'rating':
      return by(films, (f) => data(f, details)?.info.rating, (a, b) => b - a);
    case 'shortest':
      return by(films, (f) => data(f, details)?.info.runtime, (a, b) => a - b);
    case 'longest':
      return by(films, (f) => data(f, details)?.info.runtime, (a, b) => b - a);
  }
}
