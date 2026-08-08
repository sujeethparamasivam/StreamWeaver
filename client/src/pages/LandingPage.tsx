import { motion } from 'framer-motion';
import { ArrowRight, Database, Layers, ShieldCheck, Sparkles, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8 lg:px-8">
        <div className="text-xl font-semibold tracking-wide">StreamWeaver</div>
        <div className="flex items-center gap-4">
          <Link to="/auth" className="rounded-full border border-white/10 px-4 py-2 text-sm">Sign In</Link>
          <Link to="/auth" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950">Get Started</Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-24 lg:px-8">
        <section className="grid items-center gap-10 rounded-[32px] border border-white/10 bg-white/5 p-10 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr] lg:p-16">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-200">
              <Sparkles size={16} /> Enterprise ETL for modern data teams
            </div>
            <h1 className="text-5xl font-semibold leading-tight lg:text-7xl">
              High-throughput no-code ETL that scales with your data.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-300">
              Upload massive CSV and JSON files, map fields visually, transform records, validate quality, and import into MongoDB with live progress and enterprise security.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/auth" className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-3 font-medium text-slate-950">
                Start Free <ArrowRight size={18} />
              </Link>
              <Link to="/dashboard" className="rounded-full border border-white/10 px-5 py-3 font-medium">Explore Platform</Link>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="rounded-[28px] border border-white/10 bg-gradient-to-br from-cyan-500/20 via-slate-900 to-purple-500/20 p-8 shadow-2xl">
            <div className="grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Live Import Engine</span>
                  <span className="text-emerald-300">Online</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-slate-800">
                  <div className="h-3 w-3/4 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <Database className="text-cyan-300" />
                  <p className="mt-3 text-sm text-slate-400">Streamed ingestion</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <Layers className="text-violet-300" />
                  <p className="mt-3 text-sm text-slate-400">Visual mapping studio</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <ShieldCheck className="text-emerald-300" />
                  <p className="mt-3 text-sm text-slate-400">Validation & governance</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <Workflow className="text-amber-300" />
                  <p className="mt-3 text-sm text-slate-400">Workflow automation</p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
