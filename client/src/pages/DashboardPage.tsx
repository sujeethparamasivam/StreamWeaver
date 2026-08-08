import { useEffect, useState } from 'react';
import api from '../services/api';

const DashboardPage = () => {
  const [latestImport, setLatestImport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadLatest = async () => {
      try {
        const response = await api.get('/imports/latest');
        setLatestImport(response.data.job);
      } catch (err) {
        setError('Unable to load latest import summary.');
      } finally {
        setLoading(false);
      }
    };

    void loadLatest();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-7xl rounded-[32px] border border-white/10 bg-white/5 p-10 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Dashboard</p>
            <h1 className="mt-2 text-4xl font-semibold">Enterprise ETL Command Center</h1>
          </div>
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">All systems operational</div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-4">
          <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-6">
            <p className="text-sm text-slate-400">Active Imports</p>
            <p className="mt-4 text-4xl font-semibold">24</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-6">
            <p className="text-sm text-slate-400">Rows Processed</p>
            <p className="mt-4 text-4xl font-semibold">12.4M</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-6">
            <p className="text-sm text-slate-400">Success Rate</p>
            <p className="mt-4 text-4xl font-semibold">99.2%</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-6">
            <p className="text-sm text-slate-400">New Upload</p>
            <button onClick={() => window.location.assign('/upload')} className="mt-4 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950">Start Upload</button>
          </div>
        </div>

        <div className="mt-10 rounded-[32px] border border-white/10 bg-slate-900/80 p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Latest Import</p>
              <h2 className="mt-2 text-2xl font-semibold">{latestImport?.fileName ?? 'No import available yet'}</h2>
            </div>
            {loading ? (
              <p className="text-sm text-slate-400">Loading...</p>
            ) : error ? (
              <p className="text-sm text-rose-300">{error}</p>
            ) : (
              <span className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-300">{latestImport?.status ?? 'n/a'}</span>
            )}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-6">
              <p className="text-sm text-slate-400">Rows</p>
              <p className="mt-3 text-3xl font-semibold text-white">{latestImport?.totalRows ?? '—'}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-6">
              <p className="text-sm text-slate-400">Failed Rows</p>
              <p className="mt-3 text-3xl font-semibold text-white">{latestImport?.failedRows ?? '—'}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-6">
              <p className="text-sm text-slate-400">Transformed</p>
              <p className="mt-3 text-3xl font-semibold text-white">{latestImport?.transformedAt ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
