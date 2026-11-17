import type { KeyboardEvent } from 'react';
import type { ListFilm } from '../api';
import type { DetailEntry } from '../useFilmDetails';
import type { Show } from '../filters';
import { AvailRows, FilmLinks, titleYear } from './FilmParts';

interface Props {
  film: ListFilm;
  entry?: DetailEntry;
  show: Show; // only this filter's rows are shown
  hidden: Set<number>; // unchecked services are left off the card
  onOpen: (film: ListFilm) => void;
}

export default function FilmCard({ film, entry, show, hidden, onOpen }: Props) {
  const d = entry?.ok ? entry.data : null;
  const { title, year } = titleYear(film, d);

  // The whole card opens the film modal; logos and links inside do their own thing.
  const open = () => onOpen(film);
  const onKey = (e: KeyboardEvent) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      open();
    }
  };

  return (
    <article className="card" role="button" tabIndex={0} aria-haspopup="dialog" aria-label={`${title}: details`} onClick={open} onKeyDown={onKey}>
      <div className={`poster${d?.poster ? '' : ' empty'}${entry ? '' : ' shimmer'}`}>
        {d?.poster && <img src={d.poster} alt="" loading="lazy" />}
      </div>

      <div className="body">
        <h3>
          {title} {year && <span className="year">{year}</span>}
        </h3>

        <div className="avail">
          {!entry && <div className="shimmer line" />}
          {entry && !entry.ok && <p className="muted">Couldn’t look this one up ({entry.error}).</p>}
          {d && <AvailRows d={d} show={show} hidden={hidden} />}
        </div>

        <FilmLinks film={film} d={d} />
      </div>
    </article>
  );
}
