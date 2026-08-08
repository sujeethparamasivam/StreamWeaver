import { useEffect, useState } from 'react';
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

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Validation Report</p>
        <h1 className="mt-3 text-3xl font-semibold">Review row-level validation issues.</h1>
        <p className="mt-3 text-slate-400">This report surfaces warnings and errors detected during dataset ingestion.</p>
      </div>

      {loading && <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-300">Loading validations...</div>}
      {error && <div className="rounded-[32px] border border-rose-400/20 bg-rose-500/10 p-6 text-rose-200">{error}</div>}

      {!loading && records.length === 0 && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-400">No validation issues found. Your latest upload was clean.</div>
      )}

      {!loading && records.length > 0 && (
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/80">
          <div className="grid min-w-full grid-cols-[0.8fr_1.5fr_2fr_1fr] gap-4 border-b border-white/10 bg-slate-950/70 px-4 py-4 text-sm uppercase tracking-[0.18em] text-slate-400">
            <div>Row</div>
            <div>Field</div>
            <div>Message</div>
            <div>Severity</div>
          </div>
          <div className="max-h-[540px] overflow-auto px-4 py-4">
            {records.map((record, idx) => (
              <div key={idx} className="grid min-w-full grid-cols-[0.8fr_1.5fr_2fr_1fr] gap-4 border-b border-white/10 py-3 text-sm text-slate-200 last:border-b-0">
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
