import { Fragment, useEffect, useRef } from 'react';
import type { FilmInfo, ListFilm, Person } from '../api';
import type { DetailEntry } from '../useFilmDetails';
import { AvailRows, FilmLinks, availableAnywhere, titleYear } from './FilmParts';
import { longDate, upcoming } from '../release';

interface Props {
  film: ListFilm;
  entry?: DetailEntry;
  region: string;
  onClose: () => void;
}

const NO_HIDDEN = new Set<number>();

function runtimeText(info: FilmInfo) {
  if (!info.runtime) return null;
  const h = Math.floor(info.runtime / 60), m = info.runtime % 60;
  const t = h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
  return info.kind === 'tv' ? `${t} episodes` : t;
}

/**
 * A label and a comma-separated list of names. Each name links to the person's IMDb page, resolved only when clicked
 * via /api/person (one TMDB request, then cached), so showing the modal costs no extra requests.
 */
function PeopleRow({ label, people }: { label: string; people: Person[] }) {
  if (!people.length) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd className="cast">
        {people.map((p, i) => (
          <Fragment key={p.id}>
            {i > 0 && ', '}
            <a href={`/api/person?id=${p.id}`} target="_blank" rel="noopener noreferrer" title={`${p.name} on IMDb`}>
              {p.name}
            </a>
          </Fragment>
        ))}
      </dd>
    </>
  );
}

function releasedText(iso: string | null) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(+d) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function FilmModal({ film, entry, region, onClose }: Props) {
  const d = entry?.ok ? entry.data : null;
  const info = d?.info;
  const { title } = titleYear(film, d);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes; lock page scroll; move focus in, and back to the card on close.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      before?.focus?.();
    };
  }, [onClose]);

  const facts = info
    ? [
        info.certification,
        runtimeText(info),
        info.seasons ? `${info.seasons} season${info.seasons === 1 ? '' : 's'}` : null,
        info.genres.slice(0, 3).join(', ') || null,
      ].filter(Boolean)
    : [];

  // Release dates for the selected country (films), and what's coming if it's not available anywhere yet
  const todayIso = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const dateRows: [string, string][] = info
    ? ([
        ['In theaters', info.dates.theatrical],
        ['Digital', info.dates.digital],
        ['On disc', info.dates.physical],
      ].filter(([, iso]) => iso) as [string, string][])
    : [];
  const soon = d && info && !availableAnywhere(d) ? upcoming(info) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {info?.backdrop && <div className="modal-backdrop-img" style={{ backgroundImage: `url(${info.backdrop})` }} aria-hidden="true" />}

        <button ref={closeRef} type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>

        <div className="modal-grid">
          <div className="modal-poster">
            {d?.posterLarge ? (
              <img src={d.posterLarge} alt={`${title} poster`} />
            ) : (
              <div className={`poster-fallback${entry ? '' : ' shimmer'}`} />
            )}
          </div>

          <div className="modal-body">
            <p className="eyebrow">{info?.kind === 'tv' ? 'Series' : 'Film'}</p>
            <h2 id="modal-title">{title}</h2>

            {(facts.length > 0 || info?.rating != null || soon) && (
              <div className="facts">
                {soon && <span className="soon">{soon}</span>}
                {facts.map((f) => (
                  <span key={f}>{f}</span>
                ))}
                {info?.rating != null && (
                  <span className="rating" title={`${info.votes.toLocaleString()} votes on TMDB`}>
                    <b>{info.rating.toFixed(1)}</b>/10 TMDB
                  </span>
                )}
              </div>
            )}

            {info?.tagline && <p className="tagline">{info.tagline}</p>}
            {!entry && <div className="shimmer line" style={{ width: '90%', height: 60 }} />}
            {entry && !entry.ok && <p className="muted">Couldn’t look this one up ({entry.error}).</p>}
            {info?.overview && <p className="overview">{info.overview}</p>}

            {info && (info.cast.length > 0 || info.directors.length > 0 || info.released) && (
              <dl className="meta">
                {dateRows.length > 0
                  ? dateRows.map(([label, iso]) => (
                      <Fragment key={label}>
                        <dt>{label}</dt>
                        <dd>
                          {longDate(iso)}
                          {iso > todayIso && <span className="upcoming-tag">Upcoming</span>}
                        </dd>
                      </Fragment>
                    ))
                  : info.released && (
                      <>
                        <dt>{info.kind === 'tv' ? 'First aired' : 'Released'}</dt>
                        <dd>{releasedText(info.released)}</dd>
                      </>
                    )}
                <PeopleRow
                  label={info.kind === 'tv' ? 'Created by' : info.directors.length > 1 ? 'Directors' : 'Director'}
                  people={info.directors}
                />
                <PeopleRow label={info.writers.length > 1 ? 'Writers' : 'Writer'} people={info.writers} />
                <PeopleRow label="Starring" people={info.cast} />
              </dl>
            )}

            {d && (
              <section className="modal-avail">
                <p className="eyebrow">Where to watch · {region}</p>
                <div className="avail">
                  <AvailRows d={d} show="all" hidden={NO_HIDDEN} />
                </div>
              </section>
            )}

            <FilmLinks film={film} d={d} />
          </div>
        </div>
      </div>
    </div>
  );
}
