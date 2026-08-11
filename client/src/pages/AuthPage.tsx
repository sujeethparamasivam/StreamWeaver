import axios from 'axios';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const allowedDomains = ['gmail.com', 'kongu.edu'];

const isEmailValid = (value: string) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1].toLowerCase();
  return allowedDomains.some((d) => domain === d || domain.endsWith('.' + d));
};

const AuthPage = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isEmailValid(email) || password.length < 6) {
      setError('Invalid email or password.');
      return;
    }

    if (mode === 'register' && name.trim().length === 0) {
      setError('Please enter your full name.');
      return;
    }

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(String(err.response.data.message));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Authentication failed. Please check your credentials.');
      }
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-16 text-slate-100">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-5xl grid-cols-1 gap-10 rounded-[32px] border border-white/10 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl lg:grid-cols-[0.9fr_0.7fr]">
        <div className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">StreamWeaver</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Access your premium ETL workspace</h2>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Securely sign in to upload files, define mappings, validate data, and monitor import history from a modern interface.
            </p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6 shadow-xl">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Why StreamWeaver</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>• End-to-end data flows with instant preview.</li>
              <li>• Safe transformation sandbox and validation.</li>
              <li>• Fast imports with streaming support.</li>
            </ul>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 flex rounded-full border border-white/10 bg-slate-900/70 p-1">
            <button
              className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition ${mode === 'login' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'}`}
              onClick={() => setMode('login')}
            >
              Login
            </button>
            <button
              className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition ${mode === 'register' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'}`}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            {mode === 'register' && (
              <input
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
              Continue
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
