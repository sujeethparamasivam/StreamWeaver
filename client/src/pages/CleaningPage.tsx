import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

type MissingColumnSummary = {
  name: string;
  totalRows: number;
  missingValues: number;
  missingPercentage: number;
  completeCount: number;
  type: 'number' | 'date' | 'string' | 'boolean' | 'unknown';
  sampleValues: unknown[];
};

type MissingDataSummary = {
  totalRows: number;
  rowsWithMissingData: number;
  completeRows: number;
  totalMissingValues: number;
  missingPercentage: number;
};

type StrategyChoice = 'keep' | 'remove' | 'fill' | 'mean' | 'median' | 'mode';

type ColumnStrategy = {
  strategy: StrategyChoice;
  fillValue: string;
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
  const [importJobs, setImportJobs] = useState<Array<{ uploadId: string; fileName: string; status: string }>>([]);
  const [columns, setColumns] = useState<MissingColumnSummary[]>([]);
  const [summary, setSummary] = useState<MissingDataSummary | null>(null);
  const [strategies, setStrategies] = useState<Record<string, ColumnStrategy>>({});
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string>('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldSearch, setFieldSearch] = useState('');
  const [showAllColumns, setShowAllColumns] = useState(false);

  useEffect(() => {
    const loadImportJobs = async () => {
      try {
        const response = await api.get('/imports');
        setImportJobs(response.data.jobs ?? []);
      } catch {
        // Ignore import history failures.
      }
    };

    void loadImportJobs();
  }, []);

  useEffect(() => {
    const idFromQuery = searchParams.get('uploadId') ?? '';
    setUploadId(idFromQuery);
  }, [searchParams]);

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
        const fetchedSummary: MissingDataSummary | null = response.data.summary ?? null;
        setColumns(fetchedColumns);
        setSummary(fetchedSummary);

        const initialStrategies = fetchedColumns.reduce((acc, column) => {
          acc[column.name] = { strategy: 'keep', fillValue: '' };
          return acc;
        }, {} as Record<string, ColumnStrategy>);
        setStrategies(initialStrategies);

        if (!fetchedColumns.length && !fetchedSummary) {
          setError('No missing data summary is available for this upload.');
        }
      } catch (err) {
        setError('Unable to load missing data summary. Please verify the upload ID and try again.');
      } finally {
        setLoading(false);
      }
    };

    void loadMissingSummary();
  }, [uploadId]);

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

  const handleSelectDataset = (value: string) => {
    if (!value) return;
    navigate(`/cleaning?uploadId=${value}`);
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
      const refreshedSummary: MissingDataSummary | null = response.data.summary ?? null;
      setColumns(refreshed);
      setSummary(refreshedSummary);
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

  const missingSummary = useMemo(() => {
    if (!summary) {
      return {
        totalRows: 0,
        rowsWithMissingData: 0,
        completeRows: 0,
        totalMissingValues: 0,
        missingPercentage: 0,
        totalColumns: columns.length
      };
    }

    return {
      ...summary,
      totalColumns: columns.length
    };
  }, [summary, columns.length]);

  const visibleColumns = useMemo(
    () => columns
      .filter((column) => showAllColumns || column.missingValues > 0)
      .filter((column) => column.name.toLowerCase().includes(fieldSearch.toLowerCase())),
    [columns, showAllColumns, fieldSearch]
  );

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Data cleaning</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Resolve missing values before mapping.</h1>
            <p className="mt-4 text-slate-400">Choose keep, remove, or smart fill strategies to prepare your dataset for reliable transformation and downstream analytics.</p>
          </div>
        </div>
      </section>

      <div className="mt-4">
        <label htmlFor="datasetSelect" className="block text-sm font-medium text-slate-300">Select dataset</label>
        <div className="mt-2 flex gap-2">
          <select
            id="datasetSelect"
            value={uploadId}
            onChange={(event) => handleSelectDataset(event.target.value)}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
          >
            <option value="">Choose a dataset</option>
            {importJobs.map((job) => (
              <option key={job.uploadId} value={job.uploadId}>
                {job.fileName} {job.status !== 'completed' ? `(${job.status})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => handleSelectDataset(uploadId)}
            disabled={!uploadId}
            className="rounded-full border border-white/10 bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Load dataset
          </button>
        </div>
      </div>

      {!uploadId && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-300">
          <p className="text-lg font-semibold text-white">No upload selected.</p>
          <p className="mt-3 text-slate-400">Start with an import in the Upload workspace, then return here to clean missing values before mapping.</p>
          <button onClick={() => navigate('/upload')} className="mt-6 rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">Go to upload</button>
        </div>
      )}

      {loading && uploadId && <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-300">Loading missing data summary...</div>}
      {error && <div className="rounded-[32px] border border-rose-400/20 bg-rose-500/10 p-6 text-rose-200">{error}</div>}
      {message && <div className="rounded-[32px] border border-cyan-400/20 bg-cyan-500/10 p-6 text-cyan-200">{message}</div>}

      {!loading && uploadId && columns.length === 0 && !error && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-white font-semibold">No missing values detected</p>
              <p className="mt-2 text-slate-400">Your dataset is clean and ready for mapping.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/mapping?uploadId=${uploadId}`)}
              className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 whitespace-nowrap"
            >
              Continue to mapping →
            </button>
          </div>
        </div>
      )}

      {!loading && uploadId && columns.length > 0 && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6 shadow-lg">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Data quality summary</p>
                <p className="mt-2 text-slate-400">Overview of missing values and dataset readiness before mapping.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-[24px] bg-slate-900/80 p-5">
                <p className="text-sm text-slate-400">Total rows</p>
                <p className="mt-3 text-2xl font-semibold text-white">{missingSummary.totalRows.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] bg-slate-900/80 p-5">
                <p className="text-sm text-slate-400">Rows with missing data</p>
                <p className="mt-3 text-2xl font-semibold text-white">{missingSummary.rowsWithMissingData.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] bg-slate-900/80 p-5">
                <p className="text-sm text-slate-400">Complete rows</p>
                <p className="mt-3 text-2xl font-semibold text-white">{missingSummary.completeRows.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] bg-slate-900/80 p-5">
                <p className="text-sm text-slate-400">Total missing values</p>
                <p className="mt-3 text-2xl font-semibold text-white">{missingSummary.totalMissingValues.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] bg-slate-900/80 p-5">
                <p className="text-sm text-slate-400">Missing data rate</p>
                <p className="mt-3 text-2xl font-semibold text-white">{missingSummary.missingPercentage.toFixed(2)}%</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/80 shadow-2xl">
            <div className="flex flex-col gap-4 border-b border-white/10 bg-slate-950/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Fields requiring attention</p>
                <p className="mt-2 text-sm text-slate-300">Only columns with missing values are shown by default.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[220px]">
                  <input
                    type="search"
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    placeholder="Search fields..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllColumns((current) => !current)}
                  className="rounded-full border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 transition hover:bg-slate-900"
                >
                  {showAllColumns ? 'Show only missing' : 'Show all columns'}
                </button>
              </div>
            </div>

            <div className="grid min-w-full grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_1.6fr_1.2fr] gap-4 border-b border-white/10 px-4 py-4 text-sm uppercase tracking-[0.18em] text-slate-400">
              <div>Field</div>
              <div>Missing</div>
              <div>Rate</div>
              <div>Type</div>
              <div>Sample values</div>
              <div>Strategy</div>
            </div>
            <div className="divide-y divide-white/5">
              {visibleColumns.map((column) => {
                const current = strategies[column.name] ?? { strategy: 'keep', fillValue: '' };
                return (
                  <div key={column.name} className="grid min-w-full grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_1.6fr_1.2fr] gap-4 px-4 py-4 text-sm text-slate-200 items-center">
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
                    </div>
                  </div>
                );
              })}
              {visibleColumns.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-400">No columns match the filter. Toggle show all columns or update your search.</div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={applyAll}
              disabled={!columns.length || Boolean(applying)}
              className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {applying ? 'Applying…' : 'Apply Selected Strategies'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/mapping?uploadId=${uploadId}`)}
              className="rounded-full border border-white/10 bg-slate-950/90 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              Continue to mapping →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleaningPage;
