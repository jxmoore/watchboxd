import { useEffect, useRef } from 'react';
import type { FilmInfo, ListFilm } from '../api';
import type { DetailEntry } from '../useFilmDetails';
import { AvailRows, FilmLinks, titleYear } from './FilmParts';

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
            <p className="eyebrow">
              {info?.kind === 'tv' ? 'Series' : 'Film'}
              {info?.directors.length ? (
                <>
                  {' · '}
                  {info.kind === 'tv' ? 'Created by ' : 'Directed by '}
                  <span className="credit-name">{info.directors.slice(0, 2).join(' & ')}</span>
                </>
              ) : null}
            </p>
            <h2 id="modal-title">{title}</h2>

            {(facts.length > 0 || info?.rating != null) && (
              <div className="facts">
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

            {info && (info.cast.length > 0 || info.released) && (
              <dl className="meta">
                {info.released && (
                  <>
                    <dt>{info.kind === 'tv' ? 'First aired' : 'Released'}</dt>
                    <dd>{releasedText(info.released)}</dd>
                  </>
                )}
                {info.cast.length > 0 && (
                  <>
                    <dt>Starring</dt>
                    <dd>{info.cast.join(', ')}</dd>
                  </>
                )}
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
