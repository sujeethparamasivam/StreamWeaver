import { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

type MappingRow = {
  source: string;
  target: string;
  transformCode?: string;
};

interface ImportJobSummary {
  uploadId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  failedRows: number;
  createdAt?: string;
  columns?: string[];
  selectedColumns?: string[];
}

const buildMappingRows = (mapping: unknown, sourceColumns: string[]): MappingRow[] => {
  const rowsBySource = new Map<string, MappingRow>();

  if (Array.isArray(mapping)) {
    for (const item of mapping) {
      if (!item || typeof item !== 'object') continue;
      const source = (item as any).source;
      const target = (item as any).dest ?? (item as any).target;
      if (typeof source !== 'string' || typeof target !== 'string' || !target.trim()) continue;
      rowsBySource.set(source, {
        source,
        target,
        transformCode: typeof (item as any).transformCode === 'string' ? (item as any).transformCode : undefined
      });
    }
  } else if (mapping && typeof mapping === 'object') {
    for (const [dest, value] of Object.entries(mapping as Record<string, unknown>)) {
      if (!dest.trim()) continue;
      if (typeof value === 'string') {
        rowsBySource.set(value, { source: value, target: dest, transformCode: undefined });
      } else if (value && typeof value === 'object' && typeof (value as any).source === 'string') {
        rowsBySource.set((value as any).source, {
          source: (value as any).source,
          target: dest,
          transformCode: typeof (value as any).transformCode === 'string' ? (value as any).transformCode : undefined
        });
      }
    }
  }

  const rows = sourceColumns.map((source) => rowsBySource.get(source) ?? { source, target: '', transformCode: undefined });
  for (const row of rowsBySource.values()) {
    if (!sourceColumns.includes(row.source)) {
      rows.push(row);
    }
  }

  return rows;
};

const normalizeMapping = (raw: unknown): Record<string, { source: string; transformCode?: string }> => {
  const mapping: Record<string, { source: string; transformCode?: string }> = {};

  if (!raw || typeof raw !== 'object') return mapping;

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const source = (item as any).source;
      const target = (item as any).dest ?? (item as any).target;
      if (typeof source !== 'string' || !source.trim() || typeof target !== 'string' || !target.trim()) continue;
      mapping[target.trim()] = {
        source: source.trim(),
        transformCode: typeof (item as any).transformCode === 'string' ? (item as any).transformCode : undefined
      };
    }
  } else {
    for (const [dest, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!dest.trim()) continue;
      if (typeof value === 'string') {
        mapping[dest.trim()] = { source: value.trim() };
      } else if (value && typeof value === 'object' && typeof (value as any).source === 'string') {
        mapping[dest.trim()] = {
          source: (value as any).source.trim(),
          transformCode: typeof (value as any).transformCode === 'string' ? (value as any).transformCode : undefined
        };
      }
    }
  }

  return mapping;
};

const MappingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Array<Record<string, unknown>>>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadId, setUploadId] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);

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
    const loadImportData = async () => {
      const idFromQuery = searchParams.get('uploadId') ?? '';
      setUploadId(idFromQuery);

      if (!idFromQuery) {
        setPreview([]);
        setSourceColumns([]);
        setMappingRows([]);
        setError('');
        setLoading(false);
        return;
      }

      setError('');
      setLoading(true);

      try {
        const [previewResponse, mappingResponse] = await Promise.all([
          api.get('/debug/upload-rows', { params: { uploadId: idFromQuery } }),
          api.get(`/imports/${idFromQuery}`)
        ]);

        const uploadedPreview = (previewResponse.data.rows ?? []).map((row: { data: Record<string, unknown> }) => row.data ?? row);
        setPreview(uploadedPreview);

        const jobColumns = mappingResponse.data.job?.columns as string[] | undefined;
        const selectedColumnsFromJob = mappingResponse.data.job?.selectedColumns as string[] | undefined;
        const debugColumns = previewResponse.data.columns as string[] | undefined;
        const derivedColumns: string[] = Array.from(new Set(uploadedPreview.flatMap(Object.keys)));

        const chosenColumns = selectedColumnsFromJob && selectedColumnsFromJob.length
          ? selectedColumnsFromJob
          : jobColumns && jobColumns.length
            ? jobColumns
            : debugColumns && debugColumns.length
              ? debugColumns
              : derivedColumns;

        setSourceColumns(chosenColumns);

        const mappingFromJob = mappingResponse.data.job?.mapping;
        const rows = buildMappingRows(mappingFromJob, chosenColumns);
        setMappingRows(rows);
      } catch (err) {
        setPreview([]);
        setSourceColumns([]);
        setMappingRows([]);
        setError('Unable to load import mapping data.');
      } finally {
        setLoading(false);
      }
    };

    void loadImportData();
  }, [searchParams]);

  const availableSourceFields = useMemo(() => sourceColumns.length ? sourceColumns : Array.from(new Set(preview.flatMap(Object.keys))), [preview, sourceColumns]);
  const sampleRow = preview[0] ?? {};
  const mappedValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    mappingRows.forEach(({ source, target }) => {
      if (!target.trim()) return;
      values[target.trim()] = sampleRow[source] ?? '';
    });
    return values;
  }, [mappingRows, sampleRow]);

  const updateMappingRow = (index: number, changes: Partial<MappingRow>) => {
    setSaveMessage('');
    setError('');
    setMappingRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...changes } : row)));
  };

  const saveMapping = async () => {
    if (!uploadId) {
      setError('Cannot save mapping without a selected import.');
      return;
    }

    const payload = mappingRows.reduce<Record<string, { source: string; transformCode?: string }>>((acc, row) => {
      if (!row.target.trim()) return acc;
      acc[row.target.trim()] = {
        source: row.source,
        transformCode: row.transformCode?.trim() || undefined
      };
      return acc;
    }, {});

    if (!Object.keys(payload).length) {
      setError('Map at least one selected column to a target field before saving.');
      return;
    }

    setSaving(true);
    setSaveMessage('');
    setError('');

    try {
      await api.patch(`/imports/${uploadId}/mapping`, { mapping: payload });
      setSaveMessage('Mapping saved successfully.');
    } catch {
      setError('Unable to save mapping.');
    } finally {
      setSaving(false);
    }
  };

  const runTransform = async () => {
    if (!uploadId) {
      setError('Cannot run transform without a selected import.');
      return;
    }

    const payload = mappingRows.reduce<Record<string, { source: string; transformCode?: string }>>((acc, row) => {
      if (!row.target.trim()) return acc;
      acc[row.target.trim()] = {
        source: row.source,
        transformCode: row.transformCode?.trim() || undefined
      };
      return acc;
    }, {});

    if (!Object.keys(payload).length) {
      setError('Map at least one selected column to a target field before transforming.');
      return;
    }

    setSaving(true);
    setSaveMessage('');
    setError('');

    try {
      await api.patch(`/imports/${uploadId}/mapping`, { mapping: payload });
      const response = await api.post(`/imports/${uploadId}/transform`);
      const sandboxErrors = response.data.sandboxErrors ?? [];
      setSaveMessage(
        sandboxErrors.length
          ? `Transformation complete with ${sandboxErrors.length} script warning(s). Preview is ready.`
          : 'Transformation complete. Preview is ready.'
      );
      navigate('/preview');
    } catch {
      setError('Unable to run transformation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Mapping Studio</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Define mappings with precision and enterprise control.</h1>
            <p className="mt-4 text-slate-400">
              Map selected source columns to your target schema and preview transformed output before final import.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">Dataset-driven source fields</div>
        </div>

        <div className="mt-8 rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
          <label htmlFor="datasetSelect" className="block text-sm font-medium text-slate-300">Select dataset</label>
          <select
            id="datasetSelect"
            value={uploadId}
            onChange={(event) => navigate(`/mapping?uploadId=${event.target.value}`)}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
          >
            <option value="">Choose a dataset</option>
            {importJobs.map((job) => (
              <option key={job.uploadId} value={job.uploadId}>
                {job.fileName} {job.status !== 'completed' ? `(${job.status})` : ''}
              </option>
            ))}
          </select>
          {!importJobs.length && (
            <p className="mt-3 text-sm text-slate-400">No uploaded datasets found. Upload a dataset first to begin mapping.</p>
          )}
        </div>
      </section>

      {loading && <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-300">Loading sample rows...</div>}
      {error && <div className="rounded-[32px] border border-rose-400/20 bg-rose-500/10 p-6 text-rose-200">{error}</div>}

      {!loading && !error && !uploadId && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-300">Select a dataset to load available columns and enable mapping.</div>
      )}

      {!loading && !error && uploadId && (
        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
          <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Current mapping rules</p>
                <p className="mt-2 text-slate-300">Use selected source columns from your uploaded dataset as the source side for mapping.</p>
              </div>
              <div className="rounded-full bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200">Detected source columns: {availableSourceFields.length}</div>
            </div>


            {availableSourceFields.length ? (
              <div className="mt-6 space-y-4">
                {availableSourceFields.map((sourceColumn, index) => (
                  <div key={`${sourceColumn}-${index}`} className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/70 p-5 text-sm text-slate-200">
                    <div className="grid gap-3 sm:grid-cols-[1fr_1.6fr] sm:items-center">
                      <div className="font-medium text-white">{sourceColumn}</div>
                      <input
                        value={mappingRows[index]?.target ?? ''}
                        onChange={(event) => updateMappingRow(index, { target: event.target.value })}
                        placeholder="Target field name"
                        className="rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                      />
                    </div>
                    <textarea
                      value={mappingRows[index]?.transformCode ?? ''}
                      onChange={(event) => updateMappingRow(index, { transformCode: event.target.value })}
                      placeholder="Optional: custom JS transform, e.g. return value.toUpperCase();"
                      rows={3}
                      className="w-full rounded-3xl border border-white/10 bg-slate-900/70 px-4 py-3 font-mono text-xs text-cyan-100 outline-none transition focus:border-cyan-400"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-white/10 bg-slate-950/80 p-5 text-slate-400">
                No dataset columns were detected. Upload a valid CSV and select columns first.
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={saveMapping}
                disabled={saving || !availableSourceFields.length}
                className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save mapping'}
              </button>
              <button
                onClick={runTransform}
                disabled={saving || !availableSourceFields.length}
                className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Processing…' : 'Run transformation'}
              </button>
              <button
                onClick={() => navigate('/preview')}
                className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm text-slate-100 transition hover:bg-slate-800"
              >
                Go to preview
              </button>
            </div>
            {saveMessage && <p className="mt-3 text-sm text-emerald-300">{saveMessage}</p>}
          </div>

          <aside className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
            <p className="text-sm uppercase tracking-[0.35em] text-slate-300">Transformation preview</p>
            <p className="mt-3 text-slate-400">See the first destination values before applying the mapping to your full dataset.</p>
            <div className="mt-6 space-y-4">
              {Object.entries(mappedValues).map(([field, value]) => (
                <div key={field} className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{field}</p>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.25em] text-slate-400">preview</span>
                  </div>
                  <p className="mt-2 text-base text-white">{String(value ?? '—')}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default MappingPage;
