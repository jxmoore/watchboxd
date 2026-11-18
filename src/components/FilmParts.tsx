// Pieces shared by the film card and the film modal.
import { Fragment, type MouseEvent } from 'react';
import type { FilmDetails, ListFilm } from '../api';
import { CAT_LABELS, catsFor, visibleRows, type Show } from '../filters';

const stop = (e: MouseEvent) => e.stopPropagation();

export const availableAnywhere = (d: FilmDetails) => catsFor('all').some((c) => d.availability[c].length > 0);

/** Free / Subscription / Rent / Buy rows with clickable service logos. */
export function AvailRows({ d, show, hidden }: { d: FilmDetails; show: Show; hidden: Set<number> }) {
  const rows = visibleRows(d, show, hidden);
  if (!availableAnywhere(d)) return <p className="muted">Not streaming, renting or selling anywhere in this country.</p>;
  if (!rows.length) return <p className="muted">Only on services or options you’ve filtered out.</p>;
  return (
    <>
      {rows.map(([c, providers]) => (
        <div className="cat" key={c}>
          <span className={`tag ${c}`}>{CAT_LABELS[c]}</span>
          <span className="logos">
            {providers.map((p) => {
              const price = p.price ? ` · from ${p.price.text}` : '';
              const logo = p.url ? (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={stop}
                  title={(p.linkKind === 'direct' ? `Watch on ${p.name}` : `Search ${p.name} for this film`) + price}
                  className="logo-link"
                >
                  <img src={p.logo} alt={p.name} />
                </a>
              ) : (
                <img src={p.logo} alt={p.name} title={`${p.name} (no link; try Watch options)${price}`} />
              );
              // Rent/buy: the cheapest price on that service sits under its logo
              return p.price ? (
                <span key={p.id} className="priced">
                  {logo}
                  <small>{p.price.text}</small>
                </span>
              ) : (
                <Fragment key={p.id}>{logo}</Fragment>
              );
            })}
          </span>
        </div>
      ))}
    </>
  );
}

/** Watch options ↗ · Letterboxd ↗ · IMDb ↗ */
export function FilmLinks({ film, d }: { film: ListFilm; d: FilmDetails | null }) {
  return (
    <div className="actions">
      {d?.availability.link && (
        <a href={d.availability.link} target="_blank" rel="noopener noreferrer" onClick={stop} className="watch">
          Watch options
        </a>
      )}
      <a href={film.link} target="_blank" rel="noopener noreferrer" onClick={stop} className="lb">
        Letterboxd
      </a>
      {d?.imdbUrl && (
        <a href={d.imdbUrl} target="_blank" rel="noopener noreferrer" onClick={stop} className="imdb">
          IMDb
        </a>
      )}
    </div>
  );
}

/** Title and year: from TMDB once loaded, else parsed from Letterboxd's "Title (Year)". */
export function titleYear(film: ListFilm, d: FilmDetails | null) {
  return {
    title: d?.title ?? film.name.replace(/\s+\(\d{4}\)$/, ''),
    year: d?.year || film.name.match(/\((\d{4})\)$/)?.[1],
  };
}
