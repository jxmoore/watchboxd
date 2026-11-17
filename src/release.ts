import type { FilmInfo } from './api';

/** How long after a theatrical release we still say "In theaters now" (if it hasn't reached digital yet). */
const IN_THEATERS_DAYS = 100;

// Today's date in the viewer's own time zone, as YYYY-MM-DD
const today = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

function parse(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

/** "Dec 18" this year, "Dec 18, 2027" otherwise. */
export function shortDate(iso: string) {
  const d = parse(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function longDate(iso: string) {
  return parse(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * For a film that isn't streaming, renting or selling anywhere: what's coming, if we know.
 * null means it's simply not available (already out, nothing scheduled).
 */
export function upcoming(info: FilmInfo): string | null {
  const now = today();
  const { theatrical, digital } = info.dates;

  if (theatrical && theatrical > now) return `In theaters ${shortDate(theatrical)}`;
  if (digital && digital > now) return `Digital ${shortDate(digital)}`;
  if (theatrical) {
    const days = (parse(now).getTime() - parse(theatrical).getTime()) / 86_400_000;
    if (days <= IN_THEATERS_DAYS && !(digital && digital <= now)) return 'In theaters now';
  }
  if (!theatrical && !digital) {
    if (info.status === 'In Production' || info.status === 'Post Production') return 'In production';
    if (info.status === 'Planned' || info.status === 'Rumored') return 'Announced';
  }
  return null;
}
