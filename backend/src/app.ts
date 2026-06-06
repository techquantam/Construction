import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import adminRoutes from './routes/admin.routes';
import siteRoutes from './routes/site.routes';
import daybookRoutes from './routes/daybook.routes';
import ledgerRoutes from './routes/ledger.routes';
import materialRoutes from './routes/material.routes';
import dashboardRoutes from './routes/dashboard.routes';
import backupRoutes from './routes/backup.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/daybooks', daybookRoutes);
app.use('/api/ledgers', ledgerRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/backup', backupRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Construction ERP API is running' });
});

// Error handling middleware
app.use(errorHandler);

export default app;
