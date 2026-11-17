import type { FilmDetails, Provider } from './api';
import type { DetailEntry } from './useFilmDetails';

export type Cat = 'free' | 'subscription' | 'rent' | 'buy';
export type Show = 'all' | 'stream' | 'free' | 'paid';

export const CAT_LABELS: Record<Cat, string> = { free: 'Free', subscription: 'Subscription', rent: 'Rent', buy: 'Buy' };

export const SHOW_OPTIONS: [Show, string][] = [
  ['all', 'All'],
  ['stream', 'Free or subscription'],
  ['free', 'Free'],
  ['paid', 'Rent / buy only'],
];

/** Which availability rows a filter cares about. Cards show only these rows. */
export function catsFor(show: Show): Cat[] {
  switch (show) {
    case 'all': return ['free', 'subscription', 'rent', 'buy'];
    case 'stream': return ['free', 'subscription'];
    case 'free': return ['free'];
    case 'paid': return ['rent', 'buy'];
  }
}

/** The rows and logos a card should show: filtered categories, checked services only, empty rows dropped. */
export function visibleRows(d: FilmDetails, show: Show, hidden: Set<number>): [Cat, Provider[]][] {
  return catsFor(show)
    .map((c): [Cat, Provider[]] => [c, d.availability[c].filter((p) => !hidden.has(p.id))])
    .filter(([, ps]) => ps.length > 0);
}

const hasAny = (d: FilmDetails, cats: Cat[]) => cats.some((c) => d.availability[c].length > 0);

/** Not free, on subscription, for rent or for sale anywhere in the country, or couldn't be looked up on TMDB. */
export const isUnavailable = (entry: DetailEntry | undefined) =>
  !!entry && (!entry.ok || !hasAny(entry.data, catsFor('all')));

/**
 * @param showUnavailable films available nowhere are hidden unless this is on; when on, they're added to any filter.
 */
export function matches(show: Show, hidden: Set<number>, entry: DetailEntry | undefined, showUnavailable: boolean): boolean {
  // Not loaded yet: keep a placeholder in the default view (it drops out if it turns out to be unavailable),
  // but not while filtering, since we can't know whether it matches.
  if (!entry) return show === 'all' && !hidden.size;
  if (!entry.ok) return showUnavailable; // couldn't look it up: counts as unavailable
  const d = entry.data;

  const streams = hasAny(d, ['free', 'subscription']);
  if (!streams && !hasAny(d, ['rent', 'buy'])) return showUnavailable;
  if (show === 'stream' && !streams) return false;
  if (show === 'free' && !hasAny(d, ['free'])) return false;
  if (show === 'paid' && streams) return false;

  // A checked service must offer it in a shown category.
  return visibleRows(d, show, hidden).length > 0;
}
