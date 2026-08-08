import { useEffect, useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import api from '../services/api';

const PreviewPage = () => {
  const [rows, setRows] = useState<Array<{ transformedData?: Record<string, unknown> }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const response = await api.get('/transformed/latest');
        setRows(response.data.rows ?? []);
      } catch (err) {
        setError('Unable to load transformed preview rows.');
      } finally {
        setLoading(false);
      }
    };

    void loadPreview();
  }, []);

  const columns = useMemo(() => (rows.length ? Object.keys(rows[0].transformedData ?? {}) : []), [rows]);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const data = rows[index].transformedData ?? {};
    return (
      <div style={style} className="grid min-w-full grid-cols-[1.4fr_repeat(3,1fr)] gap-4 border-b border-white/10 px-4 text-sm text-slate-200 items-center">
        {columns.slice(0, 4).map((column) => (
          <div key={column} className="truncate">{String(data[column] ?? '')}</div>
        ))}
      </div>
    );
  };

  const totals = useMemo(() => ({
    rows: rows.length,
    columns: columns.length
  }), [rows, columns]);

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Dataset preview</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Inspect transformed output before final import.</h1>
            <p className="mt-4 text-slate-400">Validate field transformations and confirm data shape with a clean, enterprise-quality preview experience.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">Rows visible: {totals.rows}</div>
            <div className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">Columns shown: {totals.columns}</div>
          </div>
        </div>
      </section>

      {loading && <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-300">Loading preview...</div>}
      {error && <div className="rounded-[32px] border border-rose-400/20 bg-rose-500/10 p-6 text-rose-200">{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-400">No transformed rows found yet. Save a mapping and run transformation first.</div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/80 shadow-2xl">
          <div className="grid min-w-full grid-cols-[1.4fr_repeat(3,1fr)] gap-4 border-b border-white/10 bg-slate-950/80 px-4 py-4 text-sm uppercase tracking-[0.18em] text-slate-400">
            {columns.slice(0, 4).map((column) => (
              <div key={column}>{column}</div>
            ))}
          </div>
          <List height={560} itemCount={rows.length} itemSize={48} width="100%">
            {Row}
          </List>
        </div>
      )}
    </div>
  );
};

export default PreviewPage;
