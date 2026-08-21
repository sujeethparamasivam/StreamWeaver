import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import MemoryAudit from '../components/MemoryAudit';

const AuditPage = () => {
  const [searchParams] = useSearchParams();
  const uploadId = searchParams.get('uploadId') ?? '';
  const [job, setJob] = useState<any | null>(null);

  useEffect(() => {
    if (!uploadId) return;
    api.get(`/imports/${uploadId}`).then((r) => setJob(r.data.job)).catch(() => setJob(null));
  }, [uploadId]);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-slate-900/80 p-6">
        <h2 className="text-xl font-semibold">Memory audit</h2>
        <p className="text-sm text-slate-400">Audit memory usage for upload <strong>{uploadId}</strong></p>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <MemoryAudit uploadId={uploadId} />
        </div>
        <div>
          <div className="rounded border p-4 bg-slate-900/80">
            <div className="text-sm text-slate-400">Import job</div>
            <div className="mt-2 text-white">{job ? job.fileName : 'Loading...'}</div>
            <div className="text-sm text-slate-400">Status: {job?.status ?? '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditPage;
