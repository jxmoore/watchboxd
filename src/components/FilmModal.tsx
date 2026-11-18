import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FilmInfo, ListFilm, Person } from '../api';
import type { DetailEntry } from '../useFilmDetails';
import { AvailRows, FilmLinks, availableAnywhere, titleYear } from './FilmParts';
import { longDate, upcoming } from '../release';

interface Props {
  film: ListFilm;
  entry?: DetailEntry;
  region: string;
  onClose: () => void;
  onPrev?: (() => void) | null; // previous / next film in the current results (null at either end)
  onNext?: (() => void) | null;
  position?: { index: number; total: number } | null; // "12 of 139"
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
function PeopleRow({ label, people, limit }: { label: string; people: Person[]; limit?: number }) {
  const [all, setAll] = useState(false);
  if (!people.length) return null;
  // Show the first `limit` names and a "+N more" link for the rest (only worth it if it hides 2 or more)
  const cut = limit && people.length > limit + 1 && !all ? limit : people.length;
  return (
    <>
      <dt>{label}</dt>
      <dd className="cast">
        {people.slice(0, cut).map((p, i) => (
          <Fragment key={p.id}>
            {i > 0 && ', '}
            <a href={`/api/person?id=${p.id}`} target="_blank" rel="noopener noreferrer" title={`${p.name} on IMDb`}>
              {p.name}
            </a>
          </Fragment>
        ))}
        {cut < people.length && (
          <>
            {' '}
            <button type="button" className="more-link" onClick={() => setAll(true)}>
              +{people.length - cut} more
            </button>
          </>
        )}
      </dd>
    </>
  );
}

/** The summary, clipped to a few lines with "See more" when it's longer than that. */
function Overview({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setClipped(el.scrollHeight > el.clientHeight + 2);
  }, [text, open]);
  return (
    <div className="overview-wrap">
      <p ref={ref} className={`overview${open ? '' : ' clamped'}`}>
        {text}
      </p>
      {(clipped || open) && (
        <button type="button" className="more-link" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'See less' : 'See more'}
        </button>
      )}
    </div>
  );
}

function releasedText(iso: string | null) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(+d) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function FilmModal({ film, entry, region, onClose, onPrev, onNext, position }: Props) {
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

  // ← / → step through the results (not while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement)?.closest?.('input, select, textarea')) return;
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onPrev, onNext]);

  // Start each film at the top of the modal
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    modalRef.current?.scrollTo({ top: 0 });
  }, [film.slug]);

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
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {info?.backdrop && <div className="modal-backdrop-img" style={{ backgroundImage: `url(${info.backdrop})` }} aria-hidden="true" />}

        <div className="modal-controls">
          {position && (onPrev || onNext) && (
            <>
              <span className="modal-pos">
                {position.index} of {position.total}
              </span>
              <button type="button" className="modal-nav" aria-label="Previous film" onClick={onPrev ?? undefined} disabled={!onPrev}>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M10 3.5 5.5 8l4.5 4.5" />
                </svg>
              </button>
              <button type="button" className="modal-nav" aria-label="Next film" onClick={onNext ?? undefined} disabled={!onNext}>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3.5 10.5 8 6 12.5" />
                </svg>
              </button>
            </>
          )}
          <button ref={closeRef} type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>
        </div>

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
            {info?.overview && <Overview key={film.slug} text={info.overview} />}

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
                <PeopleRow key={`cast-${film.slug}`} label="Starring" people={info.cast} limit={3} />
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
