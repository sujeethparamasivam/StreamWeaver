import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = Router();
const memoryUsers: Array<{ id: string; name: string; email: string; password: string; role: 'user' | 'admin' }> = [];

const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const createToken = (user: { id: string; role: 'user' | 'admin' }) => {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    if (!isEmailValid(email)) {
      return res.status(400).json({ message: 'Invalid email address.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ email }).catch(() => null) || memoryUsers.find((user) => user.email === email);
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed }).catch(async () => {
      const fallbackUser = { id: `${Date.now()}`, name, email, password: hashed, role: 'user' as const };
      memoryUsers.push(fallbackUser);
      return fallbackUser;
    });

    const token = createToken({ id: (user as any)._id ? String((user as any)._id) : (user as any).id, role: (user as any).role || 'user' });
    res.status(201).json({ token, user: { id: (user as any)._id ? String((user as any)._id) : (user as any).id, name: (user as any).name || name, email: (user as any).email || email, role: (user as any).role || 'user' } });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isEmailValid(email)) {
      return res.status(400).json({ message: 'Invalid email address.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const userFromDb = await User.findOne({ email }).catch(() => null);
    const user = userFromDb || memoryUsers.find((item) => item.email === email);

    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: 'Invalid credentials' });

    const token = createToken({ id: (user as any)._id ? String((user as any)._id) : user.id, role: (user as any).role || 'user' });
    res.json({ token, user: { id: (user as any)._id ? String((user as any)._id) : user.id, name: user.name, email: user.email, role: (user as any).role || 'user' } });
  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
});

export default router;
