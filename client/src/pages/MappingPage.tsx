import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

type MappingEntry = { source: string; transformCode?: string };
type MappingState = Record<string, MappingEntry>;

const DEFAULT_MAPPING: MappingState = {
  userId: { source: 'id' },
  fullName: { source: 'name' },
  emailAddress: { source: 'email' },
  signupDate: { source: 'created_at' }
};

// Normalizes mapping data coming back from the API, which may still be in
// the legacy `{ dest: sourceFieldName }` shape from before custom
// transform code was supported.
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

const MappingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadId, setUploadId] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [mapping, setMapping] = useState<MappingState>(DEFAULT_MAPPING);

  useEffect(() => {
    const loadImportData = async () => {
      const idFromQuery = searchParams.get('uploadId') ?? '';
      setUploadId(idFromQuery);

      try {
        const previewPromise = api.get('/debug/upload-rows', { params: { uploadId: idFromQuery } });
        const mappingPromise = idFromQuery ? api.get(`/imports/${idFromQuery}`) : Promise.resolve({ data: { job: null } });

        const [previewResponse, mappingResponse] = await Promise.all([previewPromise, mappingPromise]);
        setPreview((previewResponse.data.rows ?? []).map((r: { data: Record<string, unknown> }) => r.data ?? r));

        const mappingFromJob = mappingResponse.data.job?.mapping;
        setMapping(normalizeMapping(mappingFromJob));
      } catch (err) {
        setError('Unable to load import mapping data.');
      } finally {
        setLoading(false);
      }
    };

    void loadImportData();
  }, [searchParams]);

  const sourceFields = useMemo(() => {
    if (!preview.length) return [];
    return Object.keys(preview[0]);
  }, [preview]);

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

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Mapping Studio</p>
        <h1 className="mt-3 text-3xl font-semibold">Map your source columns to destination schema.</h1>
        <p className="mt-3 text-slate-400">
          Select how input fields should transform into your target model, and optionally attach a
          custom JavaScript transform per field (e.g. <code className="text-cyan-300">return value.toUpperCase()</code>).
          Custom code runs securely in a sandboxed context on the server.
        </p>
      </div>

      {loading && <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-300">Loading sample rows...</div>}
      {error && <div className="rounded-[32px] border border-rose-400/20 bg-rose-500/10 p-6 text-rose-200">{error}</div>}

      {!loading && !error && (
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8">
            <p className="text-sm text-slate-400">Current mapping rules</p>
            <div className="mt-6 space-y-4">
              {Object.keys(mapping).map((destField) => (
                <div key={destField} className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-200">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1.6fr] sm:items-center">
                    <div className="font-medium">{destField}</div>
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
                    rows={2}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 font-mono text-xs text-cyan-100 outline-none transition focus:border-cyan-400"
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
                {saving ? 'Saving…' : 'Save Mapping'}
              </button>
              <button
                onClick={runTransform}
                disabled={saving}
                className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Processing…' : 'Run Transformation'}
              </button>
              <button
                onClick={() => navigate('/preview')}
                className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm text-slate-100 transition hover:bg-slate-800"
              >
                Go to Preview
              </button>
            </div>
            {saveMessage && <p className="mt-3 text-sm text-emerald-300">{saveMessage}</p>}
          </div>

          <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8">
            <p className="text-sm text-slate-400">Sample mapped values (source only — custom code runs server-side)</p>
            <div className="mt-6 space-y-4">
              {Object.entries(transformedSample).map(([field, value]) => (
                <div key={field} className="rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm text-slate-200">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{field}</p>
                  <p className="mt-2 text-base text-white">{String(value ?? '—')}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MappingPage;
