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

    // Join the progress room before the upload starts so no early events
    // are missed once the server begins streaming the file.
    joinRoom(clientUploadId);

    try {
      const response = await uploadFile(file, clientUploadId);
      setFileName(response.fileName);
      setUploadId(response.uploadId ?? clientUploadId);
      setTotalRows(response.total);
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
      <div className="mx-auto max-w-6xl rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Upload Dataset</p>
            <h1 className="mt-3 text-4xl font-semibold">Stream large CSV or JSON files with confidence.</h1>
          </div>
          <button onClick={() => navigate('/dashboard')} className="rounded-full border border-white/10 bg-slate-800/80 px-5 py-3 text-sm text-slate-200 transition hover:bg-slate-700">
            Back to Dashboard
          </button>
        </div>

        <div className="mt-10 rounded-[28px] border border-white/10 bg-slate-950/70 p-8">
          <div {...getRootProps()} className="min-h-[260px] rounded-[24px] border-2 border-dashed border-cyan-500/30 bg-slate-900/60 p-10 text-center transition hover:border-cyan-400 hover:bg-slate-900">
            <input {...getInputProps()} />
            <p className="text-xl font-semibold text-slate-100">
              {isDragActive ? 'Drop your dataset here' : 'Drag & drop a CSV or JSON file, or click to browse'}
            </p>
            <p className="mt-3 text-sm text-slate-400">Support for files up to 500MB in streaming mode.</p>
          </div>

          {error && <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}

          {loading && (
            <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Processing file…</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm text-slate-300">
                <div><p className="text-slate-500">Rows processed</p><p className="text-lg font-semibold text-white">{rowsProcessed.toLocaleString()}</p></div>
                <div><p className="text-slate-500">Rows/sec</p><p className="text-lg font-semibold text-white">{rowsPerSecond.toLocaleString()}</p></div>
                <div><p className="text-slate-500">Validation flags</p><p className="text-lg font-semibold text-white">{rowsFailed.toLocaleString()}</p></div>
              </div>
            </div>
          )}

          {fileName && !loading && (
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
                <p className="text-sm text-slate-400">File</p>
                <p className="mt-2 text-lg font-semibold text-white">{fileName}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
                <p className="text-sm text-slate-400">Total Rows</p>
                <p className="mt-2 text-lg font-semibold text-white">{totalRows ?? '—'}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
                <p className="text-sm text-slate-400">Preview Rows</p>
                <p className="mt-2 text-lg font-semibold text-white">{preview.length}</p>
              </div>
            </div>
          )}

          {uploadId && !loading && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => navigate(`/mapping?uploadId=${uploadId}`)} className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
                Continue to Mapping
              </button>
            </div>
          )}

          {preview.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/80">
              <div className="grid min-w-full grid-cols-[1.2fr_repeat(3,1fr)] gap-4 border-b border-white/10 bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.18em] text-slate-400">
                {columns.slice(0, 4).map((column) => (
                  <div key={column}>{column}</div>
                ))}
              </div>
              {/* Virtualized: only the rows currently on screen are ever mounted in the DOM. */}
              <List height={384} itemCount={preview.length} itemSize={44} width="100%">
                {Row}
              </List>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
