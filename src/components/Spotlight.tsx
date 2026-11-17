import type { FilmDetails, ListFilm, Provider } from '../api';

export interface Pick {
  film: ListFilm;
  d: FilmDetails;
}

interface Props {
  pick: Pick;
  hidden: Set<number>;
  canShuffle: boolean;
  onOpen: (film: ListFilm) => void;
  onShuffle: () => void;
}

function runtime(min: number | null) {
  if (!min) return null;
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

/** "Tonight's pick": one film from the list you can stream free or on subscription right now. */
export default function Spotlight({ pick, hidden, canShuffle, onOpen, onShuffle }: Props) {
  const { film, d } = pick;
  const free = d.availability.free.filter((p) => !hidden.has(p.id));
  const sub = d.availability.subscription.filter((p) => !hidden.has(p.id));
  const where: Provider[] = free.length ? free : sub;
  const how = free.length ? 'Free' : 'Streaming';
  const facts = [d.year, runtime(d.info.runtime), d.info.genres.slice(0, 2).join(' / ') || null].filter(Boolean);

  return (
    <section className="spotlight" aria-label="Tonight's pick">
      {d.info.backdrop && <div className="spotlight-bg" style={{ backgroundImage: `url(${d.info.backdrop})` }} aria-hidden="true" />}
      <div className="spotlight-body">
        <p className="kicker">Tonight’s pick · from your list</p>
        <h2>{d.title}</h2>
        <p className="spotlight-facts">{facts.join(' · ')}</p>
        {d.info.overview && <p className="spotlight-overview">{d.info.overview}</p>}
        <div className="spotlight-where">
          <span className={`badge ${free.length ? 'free' : 'subscription'}`}>{how} on</span>
          {where.slice(0, 5).map((p) =>
            p.url ? (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="logo-link" title={`Watch on ${p.name}`}>
                <img src={p.logo} alt={p.name} />
              </a>
            ) : (
              <img key={p.id} src={p.logo} alt={p.name} title={p.name} />
            ),
          )}
        </div>
        <div className="spotlight-actions">
          <button type="button" className="primary" onClick={() => onOpen(film)}>
            Details
          </button>
          {canShuffle && (
            <button type="button" className="ghost" onClick={onShuffle}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M1.5 4.5h3c2.5 0 3.5 7 6 7h3.5M1.5 11.5h3c1.1 0 1.9-1.3 2.6-2.8M9 6.3c.6-1 1.3-1.8 2.5-1.8H15M13 2.5l2 2-2 2M13 9.5l2 2-2 2" />
              </svg>
              Shuffle
            </button>
          )}
        </div>
      </div>
      {d.posterLarge && <img className="spotlight-poster" src={d.posterLarge} alt="" />}
    </section>
  );
}
