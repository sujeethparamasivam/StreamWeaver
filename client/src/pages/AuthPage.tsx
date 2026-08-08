import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const isEmailValid = (value: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
    if (!isEmailValid(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
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
      setError('Authentication failed. Please check your credentials.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">StreamWeaver</p>
          <h2 className="mt-2 text-3xl font-semibold">Access your ETL workspace</h2>
        </div>
        <div className="mb-6 flex rounded-full border border-white/10 bg-slate-900/70 p-1">
          <button className={`flex-1 rounded-full px-4 py-2 text-sm ${mode === 'login' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'}`} onClick={() => setMode('login')}>Login</button>
          <button className={`flex-1 rounded-full px-4 py-2 text-sm ${mode === 'register' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'}`} onClick={() => setMode('register')}>Register</button>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {mode === 'register' && (
            <input className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input
            className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950">Continue</button>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;
