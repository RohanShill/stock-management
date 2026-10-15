import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { authRouter } from './routes/auth.js';
import { categoriesRouter } from './routes/categories.js';
import { productsRouter } from './routes/products.js';
import { inventoryRouter } from './routes/inventory.js';
import { salesRouter } from './routes/sales.js';
import { purchasesRouter } from './routes/purchases.js';
import { partiesRouter } from './routes/parties.js';
import { expensesRouter } from './routes/expenses.js';
import { reportsRouter } from './routes/reports.js';
import { syncRouter } from './routes/sync.js';
import { customFieldsRouter } from './routes/customFields.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGINS || '*' }));
app.use(express.json({ limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate limiting (100 req per minute per IP for safety)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Hardware Store Management API v1',
  });
});

// Versioned API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/sales', salesRouter);
app.use('/api/v1/purchases', purchasesRouter);
app.use('/api/v1/parties', partiesRouter);
app.use('/api/v1/expenses', expensesRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/sync', syncRouter);
app.use('/api/v1/custom-fields', customFieldsRouter);

// Centralized error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Do not expose sensitive internal stacks in production
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(isDev ? { stack: err.stack } : {}),
  });
});
