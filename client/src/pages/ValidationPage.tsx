import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const ValidationPage = () => {
  const [records, setRecords] = useState<Array<{ field: string; message: string; severity: string; rowNumber: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadValidations = async () => {
      try {
        const response = await api.get('/validations');
        setRecords(response.data.records ?? []);
      } catch (err) {
        setError('Unable to load validation records.');
      } finally {
        setLoading(false);
      }
    };

    void loadValidations();
  }, []);

  const totals = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        acc.total += 1;
        if (record.severity === 'error') acc.errors += 1;
        else acc.warnings += 1;
        return acc;
      },
      { total: 0, errors: 0, warnings: 0 }
    );
  }, [records]);

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Validation report</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Review row-level validation issues.</h1>
            <p className="mt-4 text-slate-400">Analyze warnings and errors from your latest import using a clean, enterprise-ready validation dashboard.</p>
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">Trusted data quality insights</div>
        </div>
      </section>

      {loading && <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-300">Loading validations...</div>}
      {error && <div className="rounded-[32px] border border-rose-400/20 bg-rose-500/10 p-6 text-rose-200">{error}</div>}

      {!loading && !error && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm text-slate-400">Total issues</p>
            <p className="mt-3 text-4xl font-semibold text-white">{totals.total}</p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm text-slate-400">Errors</p>
            <p className="mt-3 text-4xl font-semibold text-rose-300">{totals.errors}</p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm text-slate-400">Warnings</p>
            <p className="mt-3 text-4xl font-semibold text-amber-300">{totals.warnings}</p>
          </div>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-400">No validation issues found. Your latest upload was clean.</div>
      )}

      {!loading && records.length > 0 && (
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/80 shadow-2xl">
          <div className="grid min-w-full grid-cols-[0.9fr_1.6fr_2fr_1fr] gap-4 border-b border-white/10 bg-slate-950/80 px-4 py-4 text-sm uppercase tracking-[0.18em] text-slate-400">
            <div>Row</div>
            <div>Field</div>
            <div>Message</div>
            <div>Severity</div>
          </div>
          <div className="max-h-[560px] overflow-auto px-4 py-4">
            {records.map((record, idx) => (
              <div key={idx} className="grid min-w-full grid-cols-[0.9fr_1.6fr_2fr_1fr] gap-4 border-b border-white/10 py-3 text-sm text-slate-200 last:border-b-0">
                <div>{record.rowNumber}</div>
                <div>{record.field}</div>
                <div>{record.message}</div>
                <div className={`${record.severity === 'error' ? 'text-rose-300' : 'text-amber-300'}`}>{record.severity}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationPage;
