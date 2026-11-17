// A strip of film running across the header: posters as frames, sprocket holes top and bottom, drifting slowly
// left in an endless loop. Decorative. The row is drawn twice so the loop is seamless.
import type { CSSProperties } from 'react';

interface Props {
  posters: { src: string; title: string }[];
}

const MIN_FRAMES = 12; // short lists repeat so the strip is always full
const SECONDS_PER_FRAME = 4;

export default function FilmStrip({ posters }: Props) {
  let frames: ({ src: string; title: string } | null)[] = posters;
  if (!frames.length) frames = Array(MIN_FRAMES).fill(null); // empty frames until posters arrive
  while (frames.length < MIN_FRAMES) frames = [...frames, ...posters];

  const row = (copy: number) =>
    frames.map((p, i) => (
      <div key={`${copy}-${i}`} className={`strip-frame${p ? '' : ' empty'}`}>
        {p && <img src={p.src} alt="" loading={i < 8 ? 'eager' : 'lazy'} />}
      </div>
    ));

  return (
    <div className="strip" aria-hidden="true">
      <div className="strip-track" style={{ '--dur': `${frames.length * SECONDS_PER_FRAME}s` } as CSSProperties}>
        {row(0)}
        {row(1)}
      </div>
    </div>
  );
}
