import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

type MissingColumnSummary = {
  name: string;
  missingValues: number;
  missingPercentage: number;
  type: 'number' | 'date' | 'string' | 'boolean' | 'unknown';
  sampleValues: unknown[];
};

type StrategyChoice = 'keep' | 'remove' | 'fill' | 'mean' | 'median' | 'mode';

type ColumnStrategy = {
  strategy: StrategyChoice;
  fillValue: string;
};

type ImportJobSummary = {
  uploadId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  failedRows: number;
  createdAt?: string;
  selectedColumns?: string[];
};

const strategyLabels: Record<StrategyChoice, string> = {
  keep: 'Keep missing values',
  remove: 'Remove rows',
  fill: 'Fill manually',
  mean: 'Fill mean',
  median: 'Fill median',
  mode: 'Fill mode'
};

const CleaningPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [uploadId, setUploadId] = useState('');
  const [columns, setColumns] = useState<MissingColumnSummary[]>([]);
  const [strategies, setStrategies] = useState<Record<string, ColumnStrategy>>({});
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string>('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [jobs, setJobs] = useState<ImportJobSummary[]>([]);

  useEffect(() => {
    const idFromQuery = searchParams.get('uploadId') ?? '';
    setUploadId(idFromQuery);
  }, [searchParams]);

  useEffect(() => {
    const loadImportJobs = async () => {
      try {
        const response = await api.get('/imports');
        setJobs(response.data.jobs ?? []);
      } catch {
        setJobs([]);
      }
    };

    void loadImportJobs();
  }, []);

  useEffect(() => {
    const loadMissingSummary = async () => {
      if (!uploadId) {
        setColumns([]);
        setStrategies({});
        setLoading(false);
        return;
      }

      setError('');
      setMessage('');
      setLoading(true);

      try {
        const response = await api.get('/cleaning', { params: { uploadId } });
        const fetchedColumns: MissingColumnSummary[] = response.data.columns ?? [];
        setColumns(fetchedColumns);

        const initialStrategies = fetchedColumns.reduce((acc, column) => {
          acc[column.name] = { strategy: 'keep', fillValue: '' };
          return acc;
        }, {} as Record<string, ColumnStrategy>);
        setStrategies(initialStrategies);

        if (!fetchedColumns.length) {
          const selectedJob = jobs.find((job) => job.uploadId === uploadId);
          if (!selectedJob) {
            setError('Upload not found for this ID. Choose a recent import or re-upload your dataset.');
          }
        }
      } catch (err) {
        setError('Unable to load missing data summary. Please verify the upload ID and try again.');
      } finally {
        setLoading(false);
      }
    };

    void loadMissingSummary();
  }, [uploadId, jobs]);

  const handleStrategyChange = (column: string, strategy: StrategyChoice) => {
    setStrategies((current) => ({
      ...current,
      [column]: { ...current[column], strategy }
    }));
  };

  const handleFillValueChange = (column: string, fillValue: string) => {
    setStrategies((current) => ({
      ...current,
      [column]: { ...current[column], fillValue }
    }));
  };

  const applyStrategy = async (column: string) => {
    if (!uploadId) return;
    const current = strategies[column];
    if (!current) return;

    if (current.strategy === 'fill' && !current.fillValue.trim()) {
      setError('Please enter a fill value before applying the strategy.');
      return;
    }

    setError('');
    setMessage('');
    setApplying(column);

    try {
      await api.post('/cleaning', {
        uploadId,
        column,
        strategy: current.strategy,
        fillValue: current.strategy === 'fill' ? current.fillValue : undefined
      });
      setMessage(`Applied ${strategyLabels[current.strategy]} to ${column}.`);
      const response = await api.get('/cleaning', { params: { uploadId } });
      const refreshed = response.data.columns ?? [];
      setColumns(refreshed);
    } catch (err) {
      setError('Unable to apply the missing data strategy. Please try again.');
    } finally {
      setApplying('');
    }
  };

  const applyAll = async () => {
    for (const column of columns.map((column) => column.name)) {
      const strategy = strategies[column]?.strategy ?? 'keep';
      if (strategy === 'keep') continue;
      await applyStrategy(column);
    }
  };

  const summary = useMemo(() => {
    const totalMissing = columns.reduce((sum, col) => sum + col.missingValues, 0);
    return {
      totalColumns: columns.length,
      totalMissing
    };
  }, [columns]);

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Data cleaning</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Resolve missing values before mapping.</h1>
            <p className="mt-4 text-slate-400">Choose keep, remove, or smart fill strategies to prepare your dataset for reliable transformation and downstream analytics.</p>
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">Missing data insights</div>
        </div>
      </section>

      {!uploadId && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-300">
          <p className="text-lg font-semibold text-white">No upload selected.</p>
          <p className="mt-3 text-slate-400">Start with an import in the Upload workspace, then return here to clean missing values before mapping.</p>
          <button onClick={() => navigate('/upload')} className="mt-6 rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">Go to upload</button>
        </div>
      )}

      {uploadId && !loading && jobs.length > 0 && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Recent imports</p>
          <div className="mt-4 grid gap-3">
            {jobs.slice(0, 4).map((job) => (
              <button
                key={job.uploadId}
                type="button"
                onClick={() => navigate(`/cleaning?uploadId=${job.uploadId}`)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-left text-slate-200 transition hover:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">{job.fileName}</span>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.25em] text-slate-400">{job.status}</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{job.totalRows.toLocaleString()} rows · {job.failedRows.toLocaleString()} flagged</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && uploadId && <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-300">Loading missing data summary...</div>}
      {error && <div className="rounded-[32px] border border-rose-400/20 bg-rose-500/10 p-6 text-rose-200">{error}</div>}
      {message && <div className="rounded-[32px] border border-cyan-400/20 bg-cyan-500/10 p-6 text-cyan-200">{message}</div>}

      {!loading && uploadId && columns.length === 0 && !error && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-400">No missing values detected for this upload. You can continue directly to mapping.</div>
      )}

      {!loading && uploadId && columns.length > 0 && (
        <div className="grid gap-6">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6 shadow-lg">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-slate-400">Columns with missing values</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary.totalColumns}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Total missing entries</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary.totalMissing}</p>
              </div>
              <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-300">
                <span>Upload ID</span>
                <span className="truncate max-w-[200px]">{uploadId}</span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/80 shadow-2xl">
            <div className="grid min-w-full grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_1.5fr_1.2fr] gap-4 border-b border-white/10 bg-slate-950/80 px-4 py-4 text-sm uppercase tracking-[0.18em] text-slate-400">
              <div>Field</div>
              <div>Missing</div>
              <div>%</div>
              <div>Type</div>
              <div>Sample values</div>
              <div>Strategy</div>
            </div>
            <div className="divide-y divide-white/5">
              {columns.map((column) => {
                const current = strategies[column.name] ?? { strategy: 'keep', fillValue: '' };
                return (
                  <div key={column.name} className="grid min-w-full grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_1.5fr_1.2fr] gap-4 px-4 py-4 text-sm text-slate-200 items-center">
                    <div className="font-medium text-white">{column.name}</div>
                    <div>{column.missingValues}</div>
                    <div>{column.missingPercentage}%</div>
                    <div>{column.type}</div>
                    <div className="text-slate-400">{column.sampleValues.slice(0, 3).map((value, idx) => <span key={idx}>{String(value)}{idx < column.sampleValues.length - 1 ? ', ' : ''}</span>)}</div>
                    <div className="space-y-3">
                      <select
                        value={current.strategy}
                        onChange={(e) => handleStrategyChange(column.name, e.target.value as StrategyChoice)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-slate-200 outline-none focus:border-cyan-400"
                      >
                        {Object.entries(strategyLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      {current.strategy === 'fill' && (
                        <input
                          type="text"
                          value={current.fillValue}
                          onChange={(event) => handleFillValueChange(column.name, event.target.value)}
                          placeholder="Fill value"
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-slate-200 outline-none focus:border-cyan-400"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => applyStrategy(column.name)}
                        disabled={Boolean(applying)}
                        className="w-full rounded-full bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
                      >
                        {applying === column.name ? 'Applying…' : 'Apply'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={applyAll}
              disabled={!columns.length || Boolean(applying)}
              className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              Apply selected strategies to all
            </button>
            <button
              type="button"
              onClick={() => navigate(`/mapping?uploadId=${uploadId}`)}
              className="rounded-full border border-white/10 bg-slate-950/90 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              Continue to mapping
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleaningPage;
