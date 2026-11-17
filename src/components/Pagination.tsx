interface Props {
  page: number; // 1-based
  pages: number;
  onPage: (p: number) => void;
}

// 1 … 4 5 [6] 7 8 … 20
function pageList(page: number, pages: number): (number | '…')[] {
  if (pages <= 9) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const from = Math.max(2, Math.min(page - 2, pages - 5));
  const to = Math.min(pages - 1, Math.max(page + 2, 6));
  if (from > 2) out.push('…');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pages - 1) out.push('…');
  out.push(pages);
  return out;
}

export default function Pagination({ page, pages, onPage }: Props) {
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pages">
      <button type="button" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        ‹
      </button>
      {pageList(page, pages).map((p, i) =>
        p === '…' ? (
          <span key={`gap${i}`} className="gap">
            …
          </span>
        ) : (
          <button type="button" key={p} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>
            {p}
          </button>
        ),
      )}
      <button type="button" disabled={page === pages} onClick={() => onPage(page + 1)} aria-label="Next page">
        ›
      </button>
    </nav>
  );
}
