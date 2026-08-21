const SettingsPage = () => {
  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Workspace Settings</p>
        <h1 className="mt-3 text-3xl font-semibold">Configure import defaults and storage.</h1>
        <p className="mt-3 text-slate-400">Set your default import rules and monitor your current persistence configuration.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-6">
          <p className="text-sm text-slate-400">Import Behavior</p>
          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            <li>• Stream CSV files in batches for better memory usage.</li>
            <li>• Persist row-level data and import metadata to MongoDB.</li>
            <li>• Preview uploaded rows and track import history.</li>
          </ul>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-6">
          <p className="text-sm text-slate-400">Storage</p>
          <div className="mt-4 space-y-3 text-sm text-slate-200">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-3">MongoDB persistence with optional Atlas support.</div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-3">Upload staging area with secure file cleanup.</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
