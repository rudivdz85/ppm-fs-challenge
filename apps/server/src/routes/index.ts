/**
 * Main router index
 * Combines all route files and exports configured router
 */

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger';
import authRoutes from './auth.routes';
import userRoutes from './users.routes';
import permissionRoutes from './permissions.routes';
import queryRoutes from './query.routes';
import hierarchyRoutes from './hierarchy.routes';

/**
 * Create and configure main API router
 * Mounts all sub-routers with their respective prefixes
 */
const createApiRouter = (): express.Router => {
  const router = express.Router();

  /**
   * @swagger
   * /health:
   *   get:
   *     tags:
   *       - Health
   *     summary: Health check
   *     description: Check the health status of the API and its dependencies
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: object
   *                       properties:
   *                         status:
   *                           type: string
   *                           example: "healthy"
   *                         timestamp:
   *                           type: string
   *                           format: date-time
   *                         version:
   *                           type: string
   *                         environment:
   *                           type: string
   */
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    });
  });

  // Swagger UI documentation
  const swaggerOptions = {
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 50px 0; }
      .swagger-ui .info .title { color: #3b82f6; }
    `,
    customSiteTitle: 'PPM API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true
    }
  };

  router.use('/docs', swaggerUi.serve);
  router.get('/docs', swaggerUi.setup(swaggerSpec, swaggerOptions));

  // OpenAPI JSON spec endpoint
  router.get('/docs/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Legacy docs endpoint for backward compatibility
  router.get('/docs/legacy', (req, res) => {
    res.json({
      success: true,
      data: {
        title: 'Hierarchical Permission Management API',
        version: process.env.API_VERSION || '1.0.0',
        description: 'REST API for managing users, permissions, and organizational hierarchies',
        endpoints: {
          authentication: '/api/auth/*',
          users: '/api/users/*',
          permissions: '/api/permissions/*',
          queries: '/api/query/*',
          hierarchies: '/api/hierarchy/*'
        },
        documentation: {
          swagger_ui: '/api/docs',
          openapi_spec: '/api/docs/openapi.json'
        },
        support: {
          health_check: '/api/health',
          status: 'https://status.company.com',
          contact: 'api-support@company.com'
        }
      }
    });
  });

  // Mount sub-routers with their prefixes
  
  /**
   * Authentication routes
   * Handles login, registration, token management, and password operations
   */
  router.use('/auth', authRoutes);

  /**
   * User management routes
   * Handles user CRUD operations, search, and profile management
   */
  router.use('/users', userRoutes);

  /**
   * Permission management routes
   * Handles permission granting, revoking, and access control operations
   */
  router.use('/permissions', permissionRoutes);

  /**
   * Query routes - Core feature
   * Handles complex user queries with analytics and filtering capabilities
   */
  router.use('/query', queryRoutes);

  /**
   * Hierarchy management routes
   * Handles organizational hierarchy structure operations
   */
  router.use('/hierarchy', hierarchyRoutes);

  return router;
};

/**
 * Export configured router instance
 */
export default createApiRouter();