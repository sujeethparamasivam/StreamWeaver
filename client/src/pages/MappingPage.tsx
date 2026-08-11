import { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

type MappingEntry = { source: string; transformCode?: string };
type MappingState = Record<string, MappingEntry>;

const DEFAULT_MAPPING: MappingState = {
  userId: { source: '' },
  fullName: { source: '' },
  emailAddress: { source: '' },
  signupDate: { source: '' }
};

const guessSourceField = (previewFields: string[], candidates: string[]) => {
  const normalized = previewFields.map((field) => field.toLowerCase());
  return candidates.find((candidate) => normalized.includes(candidate.toLowerCase())) ?? '';
};

const inferMappingFromPreview = (previewFields: string[]): MappingState => {
  if (!previewFields.length) return DEFAULT_MAPPING;

  return {
    userId: { source: guessSourceField(previewFields, ['userId', 'userid', 'id', 'user_id']) || '' },
    fullName: {
      source:
        guessSourceField(previewFields, ['fullName', 'fullname', 'name', 'full_name', 'first_name', 'firstName']) || ''
    },
    emailAddress: {
      source: guessSourceField(previewFields, ['email', 'emailAddress', 'email_address']) || ''
    },
    signupDate: {
      source: guessSourceField(previewFields, ['created_at', 'createdAt', 'signupDate', 'signup_date']) || ''
    }
  };
};

const normalizeMapping = (raw: unknown): MappingState => {
  if (!raw || typeof raw !== 'object') return DEFAULT_MAPPING;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (!entries.length) return DEFAULT_MAPPING;

  return entries.reduce<MappingState>((acc, [dest, value]) => {
    if (typeof value === 'string') {
      acc[dest] = { source: value };
    } else if (value && typeof value === 'object' && 'source' in value) {
      acc[dest] = value as MappingEntry;
    }
    return acc;
  }, {});
};

const FIELD_CANDIDATES: Record<string, string[]> = {
  userId: ['userId', 'userid', 'id', 'user_id'],
  fullName: ['fullName', 'fullname', 'name', 'full_name', 'first_name', 'firstName'],
  emailAddress: ['email', 'emailAddress', 'email_address', 'email_address'],
  signupDate: ['created_at', 'createdAt', 'signupDate', 'signup_date', 'created_on', 'createdAt']
};

const resolveMappingSources = (mapping: MappingState, previewFields: string[]): MappingState => {
  const normalizedPreview = previewFields.map((field) => field.toLowerCase());

  return Object.entries(mapping).reduce<MappingState>((acc, [dest, entry]) => {
    const currentSource = entry.source?.trim() ?? '';
    const hasSourceInPreview = currentSource && normalizedPreview.includes(currentSource.toLowerCase());

    if (hasSourceInPreview) {
      acc[dest] = entry;
      return acc;
    }

    const candidates = FIELD_CANDIDATES[dest] ?? previewFields;
    const fallbackSource = candidates.find((candidate) => normalizedPreview.includes(candidate.toLowerCase()));
    acc[dest] = { ...entry, source: fallbackSource ?? currentSource };
    return acc;
  }, {});
};

interface ImportJobSummary {
  uploadId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  failedRows: number;
  createdAt?: string;
  columns?: string[];
}

const MappingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Array<Record<string, unknown>>>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadId, setUploadId] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [mapping, setMapping] = useState<MappingState>(DEFAULT_MAPPING);

  useEffect(() => {
    const loadImportJobs = async () => {
      try {
        const response = await api.get('/imports');
        setImportJobs(response.data.jobs ?? []);
      } catch {
        // Ignore; dataset loading can still function for selected uploadId if provided
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
        setAvailableColumns([]);
        setMapping(DEFAULT_MAPPING);
        setError('');
        setLoading(false);
        return;
      }

      setError('');
      setLoading(true);

      try {
        const previewPromise = api.get('/debug/upload-rows', { params: { uploadId: idFromQuery } });
        const mappingPromise = api.get(`/imports/${idFromQuery}`);

        const [previewResponse, mappingResponse] = await Promise.all([previewPromise, mappingPromise]);
        const uploadedPreview = (previewResponse.data.rows ?? []).map((r: { data: Record<string, unknown> }) => r.data ?? r);
        setPreview(uploadedPreview);

        // Prefer the server-detected columns stored on the ImportJob (strongest source).
        // Fallback to debug route columns, then derive from preview rows.
        const jobColumns = mappingResponse.data.job?.columns as string[] | undefined;
        const selectedColumnsFromJob = mappingResponse.data.job?.selectedColumns as string[] | undefined;
        const debugColumns = previewResponse.data.columns as string[] | undefined;
        const derivedColumns: string[] = Array.from(new Set(uploadedPreview.flatMap(Object.keys)));

        const chosenColumns: string[] = selectedColumnsFromJob && selectedColumnsFromJob.length
          ? selectedColumnsFromJob
          : jobColumns && jobColumns.length
            ? jobColumns
            : debugColumns && debugColumns.length
              ? debugColumns
              : derivedColumns;

        setAvailableColumns(chosenColumns);
        if (selectedColumnsFromJob && selectedColumnsFromJob.length) {
          setAvailableColumns(selectedColumnsFromJob);
        }

        const mappingFromJob = mappingResponse.data.job?.mapping;
        const previewFields: string[] = derivedColumns;

        if (mappingFromJob && Object.keys(mappingFromJob).length) {
          setMapping(resolveMappingSources(normalizeMapping(mappingFromJob), previewFields));
        } else {
          setMapping(inferMappingFromPreview(previewFields));
        }
      } catch (err) {
        setPreview([]);
        setAvailableColumns([]);
        setMapping(DEFAULT_MAPPING);
        setError('Unable to load import mapping data.');
      } finally {
        setLoading(false);
      }
    };

    void loadImportData();
  }, [searchParams]);

  const sourceFields = useMemo(() => {
    if (availableColumns.length) {
      return Array.from(new Set([...availableColumns, ...Object.values(mapping).map((entry) => entry.source).filter(Boolean)]));
    }
    const previewFields = preview.flatMap((row) => Object.keys(row));
    const mappingFields = Object.values(mapping).map((entry) => entry.source).filter(Boolean);
    return Array.from(new Set([...previewFields, ...mappingFields]));
  }, [preview, mapping, availableColumns]);

  const sampleRow = preview[0] ?? {};

  const transformedSample = useMemo(() => {
    const row: Record<string, unknown> = {};
    Object.entries(mapping).forEach(([dest, entry]) => {
      row[dest] = sampleRow[entry.source] ?? '';
    });
    return row;
  }, [mapping, sampleRow]);

  const handleSourceChange = (destField: string, source: string) => {
    setSaveMessage('');
    setMapping((current) => ({ ...current, [destField]: { ...current[destField], source } }));
  };

  const handleTransformCodeChange = (destField: string, transformCode: string) => {
    setSaveMessage('');
    setMapping((current) => ({ ...current, [destField]: { ...current[destField], transformCode } }));
  };

  const saveMapping = async () => {
    if (!uploadId) {
      setError('Cannot save mapping without a selected import.');
      return;
    }

    setSaving(true);
    setSaveMessage('');
    setError('');

    try {
      await api.patch(`/imports/${uploadId}/mapping`, { mapping });
      setSaveMessage('Mapping saved successfully.');
    } catch (err) {
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

    setSaving(true);
    setSaveMessage('');
    setError('');

    try {
      const response = await api.post(`/imports/${uploadId}/transform`);
      const sandboxErrors = response.data.sandboxErrors ?? [];
      setSaveMessage(
        sandboxErrors.length
          ? `Transformation complete with ${sandboxErrors.length} script warning(s). Preview is ready.`
          : 'Transformation complete. Preview is ready.'
      );
      navigate('/preview');
    } catch (err) {
      setError('Unable to run transformation.');
    } finally {
      setSaving(false);
    }
  };

  const selectedJob = importJobs.find((job) => job.uploadId === uploadId);

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Mapping Studio</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Define mappings with precision and enterprise control.</h1>
            <p className="mt-4 text-slate-400">
              Map source fields to target schema, preview transformed values, and apply secure server-side transformations before import.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">Big company data modeling experience</div>
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
                <p className="mt-2 text-slate-300">Customize source-to-target field mappings and add transform logic per destination field.</p>
              </div>
              <div className="rounded-full bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200">Auto-save ready</div>
            </div>

            <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-950/80 p-5 text-sm text-slate-200">
              <div className="flex items-center gap-2">
                <p className="font-medium text-white">Available source columns</p>
                <span className="flex items-center text-slate-400" title="Columns are detected from the dataset you uploaded. Only datasets you uploaded are listed here."> 
                  <Info size={14} />
                </span>
              </div>
              <p className="mt-1 text-slate-400">Select from the detected dataset fields in the dropdowns below.</p>
              <div className="mt-4">
                {sourceFields.length ? (
                  <div className="flex flex-wrap gap-2">
                    {sourceFields.map((field) => (
                      <span key={field} className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300">
                        {field}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No columns detected in this dataset.</p>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {Object.keys(mapping).map((destField) => (
                <div key={destField} className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/70 p-5 text-sm text-slate-200">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1.6fr] sm:items-center">
                    <div className="font-medium text-white">{destField}</div>
                    <select
                      value={mapping[destField]?.source ?? ''}
                      onChange={(event) => handleSourceChange(destField, event.target.value)}
                      className="rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                    >
                      <option value="">Select source field</option>
                      {sourceFields.map((field) => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={mapping[destField]?.transformCode ?? ''}
                    onChange={(event) => handleTransformCodeChange(destField, event.target.value)}
                    placeholder="Optional: custom JS transform, e.g. return value.toUpperCase();"
                    rows={3}
                    className="w-full rounded-3xl border border-white/10 bg-slate-900/70 px-4 py-3 font-mono text-xs text-cyan-100 outline-none transition focus:border-cyan-400"
                  />
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={saveMapping}
                disabled={saving}
                className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save mapping'}
              </button>
              <button
                onClick={runTransform}
                disabled={saving}
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
              {Object.entries(transformedSample).map(([field, value]) => (
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
