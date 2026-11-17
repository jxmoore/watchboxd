import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { FilmDetails, ListFilm, Provider } from '../api';
import type { DetailEntry } from '../useFilmDetails';
import { visibleRows, type Cat, type Show } from '../filters';
import { titleYear } from './FilmParts';

interface Props {
  film: ListFilm;
  entry?: DetailEntry;
  show: Show; // the badge and logos follow the current filter
  hidden: Set<number>; // unchecked services are left off
  onOpen: (film: ListFilm) => void;
}

// The label sits at the top of the poster; the bottom strip shows as many of that option's logos as fit, then "+N".
const LOGO = 26 + 5; // logo width + gap
const MORE = 24; // room for "+N"
const STRIP_PAD = 18; // strip's left + right padding
const stop = (e: MouseEvent) => e.stopPropagation();

const BADGE: Record<Cat, string> = { free: 'Free', subscription: 'Subscription', rent: 'Rent', buy: 'Buy' };

/**
 * Best way to watch it under the current filter (free beats subscription beats rent/buy) and that option's services,
 * most widely known first. The full breakdown is in the film modal.
 */
function summary(d: FilmDetails, show: Show, hidden: Set<number>) {
  const rows = visibleRows(d, show, hidden); // free → subscription → rent → buy
  const best = rows[0]?.[0] ?? null;
  const logos: Provider[] = rows[0]?.[1] ?? []; // already sorted by how widely known each service is
  const anywhere = (['free', 'subscription', 'rent', 'buy'] as Cat[]).some((c) => d.availability[c].length);
  return { best, logos, anywhere };
}

/** A poster tile: poster with a where-to-watch badge and service logos, title and year underneath. */
export default function FilmCard({ film, entry, show, hidden, onOpen }: Props) {
  const d = entry?.ok ? entry.data : null;
  const { title, year } = titleYear(film, d);
  const s = d ? summary(d, show, hidden) : null;

  const open = () => onOpen(film);
  const onKey = (e: KeyboardEvent) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      open();
    }
  };

  let badge: { text: string; cls: string } | null = null;
  if (entry && !entry.ok) badge = { text: 'Not found', cls: 'none' };
  else if (s && !s.anywhere) badge = { text: 'Not available', cls: 'none' };
  else if (s?.best) badge = { text: BADGE[s.best], cls: s.best };
  else if (s) badge = { text: 'Filtered out', cls: 'none' };

  // How many logos fit after the label; re-measured when the tile resizes
  const total = s?.logos.length ?? 0;
  const stripRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(3);
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el || !total) return;
    const measure = () => {
      const room = el.clientWidth - STRIP_PAD;
      let n = Math.floor((room + 5) / LOGO);
      if (n < total) n = Math.floor((room + 5 - MORE) / LOGO);
      setFit(Math.max(1, Math.min(total, n))); // always show at least one service
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [total]);

  return (
    <article className="tile" role="button" tabIndex={0} aria-haspopup="dialog" aria-label={`${title}: details`} onClick={open} onKeyDown={onKey}>
      <div className={`tile-poster${entry ? '' : ' shimmer'}`}>
        {d?.poster ? (
          <img src={d.poster} alt="" loading="lazy" />
        ) : (
          entry && <span className="tile-fallback">{title}</span>
        )}
        {badge && <span className={`badge ${badge.cls}`}>{badge.text}</span>}
        {total > 0 && (
          <div className="tile-logos" ref={stripRef}>
            {s?.logos.slice(0, fit).map((p) =>
              p.url ? (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={stop}
                  title={p.linkKind === 'direct' ? `Watch on ${p.name}` : `Search ${p.name} for this film`}
                  className="logo-link"
                >
                  <img src={p.logo} alt={p.name} />
                </a>
              ) : (
                <img key={p.id} src={p.logo} alt={p.name} title={p.name} />
              ),
            )}
            {total > fit && <span className="more">+{total - fit}</span>}
          </div>
        )}
      </div>
      <h3>{title}</h3>
      {year && <p className="year">{year}</p>}
    </article>
  );
}
