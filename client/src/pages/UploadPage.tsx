import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { FixedSizeList as List } from 'react-window';
import uploadFile from '../services/uploadService';
import { joinRoom, onImportProgress } from '../services/socket';

const UploadPage = () => {
  const navigate = useNavigate();
  const [fileName, setFileName] = useState('');
  const [uploadId, setUploadId] = useState('');
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [preview, setPreview] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      setFileName(response.fileName);
      setUploadId(response.uploadId ?? clientUploadId);
      setTotalRows(response.total ?? response.totalRows ?? null);
      setPreview(response.preview ?? []);
      setProgress(100);
    } catch (err) {
      setError('Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, accept: { 'text/csv': ['.csv'], 'application/json': ['.json'] } });

  const columns = useMemo(() => (preview.length ? Object.keys(preview[0]) : []), [preview]);

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
              <p className="text-xl font-semibold text-white">{isDragActive ? 'Drop your dataset here' : 'Drag & drop a CSV or JSON file, or click to browse'}</p>
              <p className="mt-3 text-sm text-slate-400">Accepted formats: CSV, JSON. Streaming mode protects RAM and scales effortlessly.</p>
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
            )}

            {uploadId && !loading && (
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => navigate(`/mapping?uploadId=${uploadId}`)} className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
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
                <List height={260} itemCount={Math.min(preview.length, 6)} itemSize={44} width="100%">
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
