import { motion } from 'framer-motion';
import { ArrowRight, Database, Layers, ShieldCheck, Sparkles, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute left-0 top-8 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-8 lg:px-8">
        <div className="text-xl font-semibold tracking-wide text-white">StreamWeaver</div>
        <div className="flex items-center gap-4">
          <Link to="/auth" className="rounded-full border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 transition hover:border-cyan-500/30">
            Sign In
          </Link>
          <Link to="/auth" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400">
            Get Started
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-24 lg:px-8">
        <section className="grid items-center gap-10 rounded-[32px] border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr] lg:p-16">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-200">
              <Sparkles size={16} /> Enterprise ETL for modern data teams
            </div>
            <h1 className="text-5xl font-semibold leading-tight tracking-tight text-white lg:text-7xl">
              High-throughput no-code ETL that scales with your data.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-300">
              Upload massive CSV and JSON files, map fields visually, transform records, validate quality, and import into MongoDB with live progress and enterprise security.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/auth" className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-3 font-medium text-slate-950 shadow-md shadow-cyan-400/20 transition hover:bg-cyan-300">
                Start Free <ArrowRight size={18} />
              </Link>
              <Link to="/dashboard" className="rounded-full border border-white/10 bg-slate-900/80 px-5 py-3 font-medium text-slate-100 transition hover:border-cyan-500/30">
                Explore Platform
              </Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="relative rounded-[28px] border border-white/10 bg-gradient-to-br from-cyan-500/15 via-slate-900 to-violet-500/15 p-8 shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/10 to-transparent" />
            <div className="grid gap-4">
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Live Import Engine</span>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-200">Online</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-slate-800">
                  <div className="h-3 w-3/4 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                  <Database className="text-cyan-300" />
                  <p className="mt-3 text-sm text-slate-400">Streamed ingestion</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                  <Layers className="text-violet-300" />
                  <p className="mt-3 text-sm text-slate-400">Visual mapping studio</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                  <ShieldCheck className="text-emerald-300" />
                  <p className="mt-3 text-sm text-slate-400">Validation & governance</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                  <Workflow className="text-amber-300" />
                  <p className="mt-3 text-sm text-slate-400">Workflow automation</p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-3">
          {[
            { title: 'Fast ingestion', detail: 'Stream CSV and JSON at scale without waiting for file parsing.' },
            { title: 'Smart mapping', detail: 'Auto-suggest field mappings and preview destination values instantly.' },
            { title: 'Quality checks', detail: 'Surface validation issues early and keep imports clean.' }
          ].map((item) => (
            <article key={item.title} className="rounded-[28px] border border-white/10 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-500/20">
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">{item.title}</p>
              <p className="mt-4 text-base leading-7 text-slate-300">{item.detail}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
