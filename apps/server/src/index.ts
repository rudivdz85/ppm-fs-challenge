/**
 * Server entry point
 * Configures Express app with middleware, routes, and error handling
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import requestLogger from './middleware/logging.middleware';

// Import logger and database
import logger from './utils/logger';
import { db } from './database/connection';

// Import routes
import apiRoutes from './routes/index';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy if behind reverse proxy (for rate limiting and IP detection)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // requests per window
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  type: ['application/json', 'text/plain']
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Request logging middleware (logs all requests)
app.use(requestLogger);

// Root health check (simple)
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Hierarchical Permission Management API',
      status: 'running',
      version: process.env.API_VERSION || '1.0.0',
      environment: NODE_ENV,
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/api/health',
        docs: '/api/docs',
        api: '/api'
      }
    }
  });
});

// Mount API routes with /api prefix
app.use('/api', apiRoutes);

// 404 handler for undefined routes (must be before error handler)
app.use(notFoundHandler);

// Global error handler (must be last middleware)
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start server
const server = app.listen(PORT, async () => {
  logger.info('Server starting up', { port: PORT, environment: NODE_ENV });
  
  try {
    const connected = await db.testConnection();
    if (connected) {
      logger.info('Database connection established successfully');
    } else {
      logger.error('Failed to connect to database');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Database connection error during startup', { error: error.message });
    process.exit(1);
  }
  
  logger.info('Server running successfully', {
    port: PORT,
    environment: NODE_ENV,
    apiDocs: `http://localhost:${PORT}/api/docs`,
    healthCheck: `http://localhost:${PORT}/api/health`
  });
  
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;