import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';

interface AuthRequest extends Request {
  admin?: { 
    id: string;
    role: string;
    allowedLedgerId: string | null;
  };
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: string };

      const dbAdmin = await prisma.admin.findUnique({
        where: { id: decoded.id }
      });

      if (!dbAdmin) {
        res.status(401).json({ success: false, message: 'Not authorized, user not found' });
        return;
      }

      req.admin = { 
        id: decoded.id,
        role: dbAdmin.role || 'ADMIN',
        allowedLedgerId: dbAdmin.allowedLedgerId || null
      };
      next();
    } catch (error) {
      res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: any, res: Response, next: NextFunction): void => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to perform this action.' });
      return;
    }
    next();
  };
};
