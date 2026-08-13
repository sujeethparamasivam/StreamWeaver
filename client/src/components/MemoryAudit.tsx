import React, { useEffect, useState } from 'react';

type Audit = {
  summary: { peakRss: number; peakHeap: number; avgRss: number; avgHeap: number; samples: number };
  memoryLimitMB: number;
  peakRssMB: number;
  pass: boolean;
};

export default function MemoryAudit({ uploadId }: { uploadId: string }) {
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!uploadId) return;
    let mounted = true;
    setLoading(true);

    // first fetch job to check status; only fetch audit when job is completed
    fetch(`/api/imports/${uploadId}`).then((r) => r.json()).then((data) => {
      if (!mounted) return;
      const job = data.job as any;
      setJobStatus(job?.status ?? null);
      if (job?.status === 'completed') {
        return fetch(`/api/imports/${uploadId}/audit`).then((r) => r.json()).then((auditData) => {
          if (!mounted) return;
          setAudit(auditData);
        });
      }
    }).catch(() => {
      // ignore
    }).finally(() => {
      if (mounted) setLoading(false);
    });

    return () => { mounted = false; };
  }, [uploadId]);

  if (!uploadId) return null;
  if (loading) return <div className="p-2">Loading memory audit...</div>;
  if (!audit) {
    if (jobStatus && jobStatus !== 'completed') return <div className="p-2">Audit pending — import status: {jobStatus}</div>;
    return <div className="p-2">No audit available</div>;
  }

  return (
    <div className="border rounded p-3 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Memory Audit</div>
        <div className={`text-xs font-semibold ${audit.pass ? 'text-green-600' : 'text-red-600'}`}>{audit.pass ? 'PASS' : 'FAIL'}</div>
      </div>
      <div className="mt-2 text-sm">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-xs uppercase text-slate-400">Peak RSS</div>
            <div className="text-sm font-medium">{(audit.summary.peakRss / 1024 / 1024).toFixed(1)} MB</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Avg RSS</div>
            <div className="text-sm font-medium">{(audit.summary.avgRss / 1024 / 1024).toFixed(1)} MB</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Samples</div>
            <div className="text-sm font-medium">{audit.summary.samples}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs uppercase text-slate-400">Limit</div>
            <div className="text-sm font-medium">{audit.memoryLimitMB} MB</div>
          </div>
        </div>
        <div className="mt-3">
          {/* simple sparkline from samples (uses rss values) */}
          {Array.isArray((audit as any).samples) && (audit as any).samples.length > 0 ? (
            <svg viewBox="0 0 100 20" className="w-full h-6">
              {(() => {
                const samplesArr = (audit as any).samples as any[];
                const vals = samplesArr.map((s: any) => s.rss / 1024 / 1024);
                const min = Math.min(...vals);
                const max = Math.max(...vals) || 1;
                const points = vals.map((v, i) => `${(i / Math.max(vals.length - 1, 1)) * 100},${20 - ((v - min) / (max - min)) * 18}`).join(' ');
                return <polyline fill="none" stroke="#06b6d4" strokeWidth={1.5} points={points} />;
              })()}
            </svg>
          ) : null}
        </div>
      </div>
    </div>
  );
}
