import { useEffect, useState } from 'react';
import api from '../services/api';

interface ImportJob {
  uploadId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  failedRows: number;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

const HistoryPage = () => {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await api.get('/imports');
        setJobs(response.data.jobs ?? []);
      } catch (err) {
        setError('Unable to load import history.');
      } finally {
        setLoading(false);
      }
    };

    void loadHistory();
  }, []);

  const totalRows = jobs.reduce((sum, job) => sum + job.totalRows, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Import History</p>
        <h1 className="mt-3 text-3xl font-semibold">Track every dataset import.</h1>
        <p className="mt-3 text-slate-400">Review the latest ingestion jobs, status, and row counts from your ETL pipeline.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-6">
          <p className="text-sm text-slate-400">Import Jobs</p>
          <p className="mt-3 text-4xl font-semibold text-white">{jobs.length}</p>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-6">
          <p className="text-sm text-slate-400">Rows Ingested</p>
          <p className="mt-3 text-4xl font-semibold text-white">{totalRows}</p>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-6">
          <p className="text-sm text-slate-400">Last Updated</p>
          <p className="mt-3 text-4xl font-semibold text-white">{jobs[0] ? new Date(jobs[0].createdAt).toLocaleDateString() : '—'}</p>
        </div>
      </div>

      {loading && <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-300">Loading history...</div>}
      {error && <div className="rounded-[32px] border border-rose-400/20 bg-rose-500/10 p-6 text-rose-200">{error}</div>}

      {!loading && !error && jobs.length === 0 && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-400">No import history available yet. Upload a dataset to begin tracking jobs.</div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/80">
          <div className="grid min-w-full grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-4 border-b border-white/10 bg-slate-950/70 px-4 py-4 text-sm uppercase tracking-[0.18em] text-slate-400">
            <div>Dataset</div>
            <div>Status</div>
            <div>Rows</div>
            <div>Failed</div>
            <div>Started</div>
          </div>
          <div className="max-h-[520px] overflow-auto px-4 py-4">
            {jobs.map((job) => (
              <div key={job.uploadId} className="grid min-w-full grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-4 border-b border-white/10 py-3 text-sm text-slate-200 last:border-b-0">
                <div className="truncate">{job.fileName}</div>
                <div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${job.status === 'completed' ? 'bg-emerald-500/15 text-emerald-200' : job.status === 'failed' ? 'bg-rose-500/15 text-rose-200' : 'bg-amber-500/15 text-amber-200'}`}>
                    {job.status}
                  </span>
                </div>
                <div>{job.totalRows}</div>
                <div>{job.failedRows}</div>
                <div>{job.startedAt ? new Date(job.startedAt).toLocaleDateString() : '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
