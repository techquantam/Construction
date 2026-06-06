import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';

const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: (process.env.JWT_EXPIRES_IN || '30d') as any,
  });
};

export const loginAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ success: false, message: 'Please provide username and password' });
      return;
    }

    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (admin && (await bcrypt.compare(password, admin.password))) {
      res.json({
        success: true,
        data: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          token: generateToken(admin.id),
        },
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req: any, res: Response): Promise<void> => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { id: true, username: true, email: true, createdAt: true },
    });

    res.json({ success: true, data: admin });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// One-time setup route, can be disabled later
export const setupAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;
    
    const count = await prisma.admin.count();
    if (count > 0) {
      res.status(400).json({ success: false, message: 'Admin already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin = await prisma.admin.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        token: generateToken(admin.id),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
