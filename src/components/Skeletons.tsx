// Loading placeholders shaped like the real thing, so the page doesn't jump when content arrives.

/** The list header: eyebrow, title and stats. */
export function SummarySkeleton() {
  return (
    <section className="summary" aria-hidden="true">
      <div className="sk-summary">
        <span className="sk sk-eyebrow" />
        <span className="sk sk-title" />
        <span className="sk sk-stats" />
      </div>
    </section>
  );
}

/** Tonight's pick: the panel with text lines on the left and a poster on the right. */
export function SpotlightSkeleton() {
  return (
    <section className="spotlight sk-spotlight" aria-hidden="true">
      <div className="spotlight-body">
        <span className="sk sk-eyebrow" />
        <span className="sk sk-heading" />
        <span className="sk sk-line" style={{ width: '40%' }} />
        <span className="sk sk-line" style={{ width: '92%', marginTop: 18 }} />
        <span className="sk sk-line" style={{ width: '86%' }} />
        <span className="sk sk-line" style={{ width: '60%' }} />
        <span className="sk sk-button" />
      </div>
      <span className="sk sk-poster" />
    </section>
  );
}

/** The poster grid: poster tiles with a title and year line under each. */
export function GridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid" aria-hidden="true">
      {Array.from({ length: Math.max(count, 1) }, (_, i) => (
        <div key={i} className="tile sk-tile" style={{ animationDelay: `${(i % 6) * 60}ms` }}>
          <span className="sk tile-poster" />
          <span className="sk sk-line" style={{ width: '80%', marginTop: 12 }} />
          <span className="sk sk-line" style={{ width: '30%', height: 10 }} />
        </div>
      ))}
    </div>
  );
}
