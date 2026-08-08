import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, Upload, Database, Layers, Settings, FileSearch, UserCircle2 } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: Home },
  { label: 'Upload Dataset', path: '/upload', icon: Upload },
  { label: 'Preview Data', path: '/preview', icon: Database },
  { label: 'Mapping Studio', path: '/mapping', icon: Layers },
  { label: 'Validations', path: '/validations', icon: FileSearch },
  { label: 'Import History', path: '/history', icon: Database },
  { label: 'Settings', path: '/settings', icon: Settings }
];

const AppShell = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[300px_1fr]">
        <aside className="border-r border-white/10 bg-slate-950/95 p-6 backdrop-blur-xl">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">StreamWeaver</p>
            <h2 className="mt-4 text-3xl font-semibold">ETL Workspace</h2>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} className={`flex items-center gap-3 rounded-3xl px-4 py-3 text-sm transition ${active ? 'bg-cyan-500/20 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-10 rounded-[28px] border border-white/10 bg-slate-900/70 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-500/20 p-3">
                <UserCircle2 size={20} />
              </div>
              <div>
                <p className="text-sm text-slate-400">Signed in as</p>
                <p className="font-medium">Demo User</p>
              </div>
            </div>
          </div>
        </aside>
        <main className="px-6 py-6 lg:px-10 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
