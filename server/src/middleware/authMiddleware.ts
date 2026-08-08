import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthedRequest extends Request {
  user?: { id: string; role: 'user' | 'admin' };
}

export const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret') as { id: string; role: 'user' | 'admin' };
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
