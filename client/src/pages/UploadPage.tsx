import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { FixedSizeList as List } from 'react-window';
import api from '../services/api';
import uploadFile from '../services/uploadService';
import { joinRoom, onImportProgress } from '../services/socket';

const UploadPage = () => {
  const navigate = useNavigate();
  const [fileName, setFileName] = useState('');
  const [uploadId, setUploadId] = useState('');
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [preview, setPreview] = useState<Array<Record<string, unknown>>>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [columnSearch, setColumnSearch] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingColumns, setSavingColumns] = useState(false);

  const [progress, setProgress] = useState(0);
  const [rowsProcessed, setRowsProcessed] = useState(0);
  const [rowsFailed, setRowsFailed] = useState(0);
  const [rowsPerSecond, setRowsPerSecond] = useState(0);

  const clientUploadIdRef = useRef('');

  useEffect(() => {
    const unsubscribe = onImportProgress((payload) => {
      if (payload.uploadId !== clientUploadIdRef.current) return;
      setProgress(payload.progress);
      setRowsProcessed(payload.rowsProcessed);
      setRowsFailed(payload.rowsFailed);
      setRowsPerSecond(payload.rowsPerSecond ?? 0);
    });
    return unsubscribe;
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    const file = acceptedFiles[0];
    setError('');

    if (!['text/csv', 'application/json', 'application/octet-stream'].includes(file.type) && !/\.(csv|json)$/i.test(file.name)) {
      setError('Only CSV and JSON files are supported.');
      return;
    }

    const clientUploadId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    clientUploadIdRef.current = clientUploadId;

    setProgress(0);
    setRowsProcessed(0);
    setRowsFailed(0);
    setRowsPerSecond(0);
    setLoading(true);

    joinRoom(clientUploadId);

    try {
      const response = await uploadFile(file, clientUploadId);
      const uploadPreview = response.preview ?? [];
      const id = response.uploadId ?? clientUploadId;
      const columns = response.columns ?? Array.from(new Set(uploadPreview.flatMap(Object.keys)));

      setFileName(response.fileName);
      setUploadId(id);
      setTotalRows(response.total ?? response.totalRows ?? null);
      setPreview(uploadPreview);
      setAvailableColumns(columns);
      setSelectedColumns(columns);
      setProgress(100);

      const profileResponse = await api.get('/profiling', { params: { uploadId: id } });
      setProfile(profileResponse.data.profile);
    } catch (err) {
      setError('Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleColumn = (column: string) => {
    setSelectedColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column]
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns(availableColumns);
  };

  const clearAllColumns = () => {
    setSelectedColumns([]);
  };

  const saveSelectedColumns = async () => {
    if (!uploadId) return;
    setSavingColumns(true);
    try {
      await api.patch(`/imports/${uploadId}/columns`, { selectedColumns });
    } catch {
      setError('Unable to save selected columns.');
    } finally {
      setSavingColumns(false);
    }
  };

  const continueToMapping = async () => {
    if (!selectedColumns.length) {
      setError('Select at least one column before continuing.');
      return;
    }

    if (uploadId) {
      setSavingColumns(true);
      try {
        await api.patch(`/imports/${uploadId}/columns`, { selectedColumns });
        navigate(`/mapping?uploadId=${uploadId}`);
      } catch {
        setError('Unable to save selected columns.');
      } finally {
        setSavingColumns(false);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ onDrop, multiple: false, accept: { 'text/csv': ['.csv'], 'application/json': ['.json'] } });

  const columns = useMemo(() => (preview.length ? Object.keys(preview[0]) : []), [preview]);
  const filteredColumns = useMemo(
    () => availableColumns.filter((column) => column.toLowerCase().includes(columnSearch.toLowerCase())),
    [availableColumns, columnSearch]
  );

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = preview[index];
    return (
      <div style={style} className="grid min-w-full grid-cols-[1.2fr_repeat(3,1fr)] gap-4 border-b border-white/10 px-4 text-sm text-slate-200 items-center">
        {columns.slice(0, 4).map((column) => (
          <div key={column} className="truncate">{String(row[column] ?? '')}</div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Upload dataset</p>
              <h1 className="mt-3 text-4xl font-semibold text-white">Enterprise-grade data ingestion with end-to-end visibility.</h1>
              <p className="mt-4 text-slate-400">
                Upload large CSV or JSON files using a secure, streamed ingestion channel designed for modern data teams.
              </p>
            </div>
            <button onClick={() => navigate('/dashboard')} className="inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-800/90 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700">
              Back to dashboard
            </button>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
            <div {...getRootProps()} className="min-h-[280px] rounded-[28px] border-2 border-dashed border-cyan-500/30 bg-slate-950/80 p-10 text-center transition hover:border-cyan-400 hover:bg-slate-900">
              <input {...getInputProps()} />
              <p className="text-xl font-semibold text-white">{isDragActive ? 'Drop your dataset here' : 'Drag & drop a CSV or JSON file'}</p>
              <p className="mt-3 text-sm text-slate-400">Accepted formats: CSV, JSON. Streaming mode protects RAM and scales effortlessly.</p>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  open();
                }}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Choose file
              </button>
            </div>

            {error && <div className="mt-6 rounded-3xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_0.8fr]">
              <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Upload status</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/80 text-lg font-semibold text-cyan-300">{progress}%</div>
                  <div>
                    <p className="text-sm text-slate-300">Live ingestion</p>
                    <p className="mt-2 text-xl font-semibold text-white">{loading ? 'Processing' : fileName ? 'Ready' : 'Waiting'}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Performance</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between"><span>Rows processed</span><span>{rowsProcessed.toLocaleString()}</span></div>
                  <div className="flex items-center justify-between"><span>Rows/sec</span><span>{rowsPerSecond.toLocaleString()}</span></div>
                  <div className="flex items-center justify-between"><span>Validation flags</span><span className="text-rose-300">{rowsFailed.toLocaleString()}</span></div>
                </div>
              </div>
            </div>

            {fileName && !loading && (
              <>
                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
                    <p className="text-sm text-slate-400">Current file</p>
                    <p className="mt-3 text-lg font-semibold text-white">{fileName}</p>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
                    <p className="text-sm text-slate-400">Total rows</p>
                    <p className="mt-3 text-lg font-semibold text-white">{totalRows ?? '—'}</p>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
                    <p className="text-sm text-slate-400">Preview rows</p>
                    <p className="mt-3 text-lg font-semibold text-white">{preview.length}</p>
                  </div>
                </div>

                {availableColumns.length > 0 && (
                  <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-950/80 p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Detected columns</p>
                        <p className="mt-2 text-sm text-slate-300">Select the columns you want to keep in the dataset.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={selectAllColumns} className="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-white transition hover:bg-slate-800">
                          Select All
                        </button>
                        <button onClick={clearAllColumns} className="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-white transition hover:bg-slate-800">
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <input
                        type="search"
                        value={columnSearch}
                        onChange={(e) => setColumnSearch(e.target.value)}
                        placeholder="Search columns..."
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                      />
                      <div className="grid gap-2 max-h-72 overflow-auto rounded-[24px] border border-white/10 bg-slate-900/80 p-4">
                        {filteredColumns.length ? (
                          filteredColumns.map((column) => {
                            const isSelected = selectedColumns.includes(column);
                            return (
                              <button
                                key={column}
                                type="button"
                                onClick={() => toggleColumn(column)}
                                className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left transition ${isSelected ? 'bg-cyan-500/20 text-white border border-cyan-500/40' : 'bg-slate-950/70 text-slate-200 border border-white/10 hover:bg-slate-900'}`}
                              >
                                <span>{column}</span>
                                <span>{isSelected ? '☑' : '☐'}</span>
                              </button>
                            );
                          })
                        ) : (
                          <p className="text-sm text-slate-500">No columns match your search.</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-slate-950/80 p-4">
                        <p className="text-sm text-slate-300">Selected: {selectedColumns.length} / {availableColumns.length}</p>
                        <button
                          type="button"
                          onClick={saveSelectedColumns}
                          disabled={savingColumns}
                          className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
                        >
                          {savingColumns ? 'Saving...' : 'Save selection'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {profile && (
                  <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-950/80 p-6">
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Dataset overview</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-4">
                        <p className="text-sm text-slate-400">Rows</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{profile.totalRows}</p>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-4">
                        <p className="text-sm text-slate-400">Columns</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{profile.totalColumns}</p>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-4">
                        <p className="text-sm text-slate-400">Missing values</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{profile.totalMissingValues}</p>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-4">
                        <p className="text-sm text-slate-400">Duplicates</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{profile.totalDuplicateRows}</p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-4">
                        <p className="text-sm text-slate-400">Numeric columns</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{profile.numberNumericColumns}</p>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-4">
                        <p className="text-sm text-slate-400">Text columns</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{profile.numberTextColumns}</p>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-4">
                        <p className="text-sm text-slate-400">Date columns</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{profile.numberDateColumns}</p>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-4">
                        <p className="text-sm text-slate-400">Quality score</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{profile.qualityScore}%</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {uploadId && !loading && (
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate(`/cleaning?uploadId=${uploadId}`)}
                  className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Review missing data
                </button>
                <button
                  onClick={continueToMapping}
                  className="rounded-full border border-white/10 bg-slate-950/90 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                >
                  Continue to mapping
                </button>
              </div>
            )}
          </div>

          <aside className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Upload intelligence</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Premium ingestion controls</h2>
            <p className="mt-4 text-slate-400">Keep your enterprise pipeline transparent, efficient, and resilient with advanced monitoring and secure staging.</p>
            <div className="mt-6 space-y-4 text-sm text-slate-300">
              <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-4">
                <p className="font-semibold text-white">Instant preview</p>
                <p className="mt-2 text-slate-400">See the first rows immediately after upload so mapping can start without delay.</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-4">
                <p className="font-semibold text-white">Streamed processing</p>
                <p className="mt-2 text-slate-400">Large files are streamed end-to-end, avoiding memory issues and keeping UI latency low.</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-4">
                <p className="font-semibold text-white">Secure staging</p>
                <p className="mt-2 text-slate-400">Files are handled safely before transformation and can be routed to your secure storage layer.</p>
              </div>
            </div>

            {preview.length > 0 && (
              <div className="mt-8 overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/80">
                <div className="grid min-w-full grid-cols-[1.2fr_repeat(3,1fr)] gap-4 border-b border-white/10 bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.18em] text-slate-400">
                  {columns.slice(0, 4).map((column) => (
                    <div key={column}>{column}</div>
                  ))}
                </div>
                <List height={260} itemCount={preview.length} itemSize={44} width="100%">
                  {Row}
                </List>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
