// A wall of posters tipped back in perspective behind the header, like a lobby display seen at an angle.
// Decorative. `posters` are the main ones (your list); when there are fewer than TARGET, `fillers` (trending
// films) top the wall up. Main posters take the most visible tiles: the right-hand side, away from the dark
// pool behind the text. Everything then repeats to fill the grid. Empty tiles show until posters arrive.

type Poster = { src: string; title: string };

interface Props {
  posters: Poster[];
  fillers?: Poster[];
}

const COLS = 12;
const ROWS = 6;
const TOP_UP_BELOW = 24; // lists with fewer posters than this get topped up…
const TARGET = 40; // …to this many different posters

// Tile indexes ordered from most to least visible. Measured on a desktop window, the bright, on-screen part of the
// tilted wall is around column 8 of the middle rows (columns 0–5 sit under the dark pool, 11 falls off the edge).
const SWEET_COL = 8;
const SWEET_ROW = 2.5;
const BY_VISIBILITY = Array.from({ length: COLS * ROWS }, (_, i) => i).sort((a, b) => {
  const dist = (i: number) => ((i % COLS) - SWEET_COL) ** 2 + ((Math.floor(i / COLS) - SWEET_ROW) * 1.6) ** 2;
  return dist(a) - dist(b) || a - b;
});

export default function PosterWall({ posters, fillers = [] }: Props) {
  const have = new Set(posters.map((p) => p.src));
  const extra = posters.length >= TOP_UP_BELOW ? [] : fillers.filter((f) => !have.has(f.src)).slice(0, TARGET - posters.length);
  const pool = [...posters, ...extra];

  const tiles: (Poster | null)[] = Array(COLS * ROWS).fill(null);
  if (pool.length) BY_VISIBILITY.forEach((tile, k) => (tiles[tile] = pool[k % pool.length]));

  return (
    <div className="wall" aria-hidden="true">
      <div className="wall-grid">
        {tiles.map((p, i) => (
          <div key={i} className={`wall-tile${p ? '' : ' empty'}`}>
            {p && <img src={p.src} alt="" loading={i < 36 ? 'eager' : 'lazy'} />}
          </div>
        ))}
      </div>
    </div>
  );
}
