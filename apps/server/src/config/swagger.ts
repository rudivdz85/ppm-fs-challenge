/**
 * Swagger/OpenAPI configuration
 * Defines the API documentation structure and endpoints
 */

import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Hierarchical Permission Management API',
    version: process.env.API_VERSION || '1.0.0',
    description: `
      A comprehensive REST API for managing users, permissions, and organizational hierarchies.
      
      ## Features
      - **User Management**: Create, update, and manage user accounts
      - **Permission System**: Grant, revoke, and manage permissions with inheritance
      - **Hierarchy Management**: Organize users in hierarchical structures
      - **Advanced Queries**: Complex filtering and analytics capabilities
      - **Authentication**: JWT-based authentication with refresh tokens
      
      ## Authentication
      Most endpoints require authentication via JWT tokens. Include the token in the Authorization header:
      \`Authorization: Bearer <your-jwt-token>\`
      
      ## Rate Limiting
      API requests are rate-limited to 100 requests per 15 minutes per IP address.
      
      ## Error Handling
      All responses follow a consistent format with success/error indicators and detailed error messages.
    `,
    termsOfService: 'https://api.company.com/terms',
    contact: {
      name: 'API Support',
      email: 'api-support@company.com',
      url: 'https://support.company.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: `http://localhost:${process.env.PORT || 3000}/api`,
      description: 'Development server'
    },
    {
      url: 'https://api-staging.company.com/api',
      description: 'Staging server'
    },
    {
      url: 'https://api.company.com/api',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for authentication'
      }
    },
    schemas: {
      User: {
        type: 'object',
        required: ['id', 'email', 'full_name', 'base_hierarchy_id'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique user identifier'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address (unique)'
          },
          full_name: {
            type: 'string',
            description: 'User full name'
          },
          base_hierarchy_id: {
            type: 'string',
            format: 'uuid',
            description: 'Primary hierarchy the user belongs to'
          },
          hierarchy_path: {
            type: 'string',
            description: 'Hierarchical path (e.g., /company/division/department)'
          },
          hierarchy_name: {
            type: 'string',
            description: 'Name of the primary hierarchy'
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the user account is active'
          },
          phone: {
            type: 'string',
            description: 'User phone number (optional)'
          },
          metadata: {
            type: 'object',
            description: 'Additional user metadata as key-value pairs'
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp'
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        },
        example: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'john.doe@company.com',
          full_name: 'John Doe',
          base_hierarchy_id: '987fcdeb-51a2-43d1-9876-123456789abc',
          hierarchy_path: '/company/sales/north-america',
          hierarchy_name: 'North America Sales',
          is_active: true,
          phone: '+1-555-0123',
          metadata: {
            department: 'Sales',
            employee_id: 'EMP001'
          },
          created_at: '2024-01-15T08:00:00.000Z',
          updated_at: '2024-01-15T08:00:00.000Z'
        }
      },
      Permission: {
        type: 'object',
        required: ['id', 'user_id', 'hierarchy_id', 'role'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique permission identifier'
          },
          user_id: {
            type: 'string',
            format: 'uuid',
            description: 'User who has this permission'
          },
          hierarchy_id: {
            type: 'string',
            format: 'uuid',
            description: 'Hierarchy this permission applies to'
          },
          hierarchy_name: {
            type: 'string',
            description: 'Name of the hierarchy'
          },
          hierarchy_path: {
            type: 'string',
            description: 'Hierarchical path'
          },
          role: {
            type: 'string',
            enum: ['read', 'manager', 'admin'],
            description: 'Permission level (read < manager < admin)'
          },
          inherit_to_descendants: {
            type: 'boolean',
            description: 'Whether permission applies to child hierarchies'
          },
          granted_by: {
            type: 'string',
            format: 'uuid',
            description: 'User who granted this permission'
          },
          granted_at: {
            type: 'string',
            format: 'date-time',
            description: 'When the permission was granted'
          },
          expires_at: {
            type: 'string',
            format: 'date-time',
            description: 'Optional expiration date'
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the permission is currently active'
          },
          metadata: {
            type: 'object',
            description: 'Additional permission metadata'
          }
        }
      },
      HierarchyStructure: {
        type: 'object',
        required: ['id', 'name', 'path', 'depth'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique hierarchy identifier'
          },
          name: {
            type: 'string',
            description: 'Hierarchy name'
          },
          description: {
            type: 'string',
            description: 'Hierarchy description'
          },
          path: {
            type: 'string',
            description: 'Hierarchical path (e.g., /company/division/department)'
          },
          parent_id: {
            type: 'string',
            format: 'uuid',
            description: 'Parent hierarchy ID (null for root)'
          },
          depth: {
            type: 'integer',
            description: 'Depth level in the hierarchy (0 for root)'
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the hierarchy is active'
          },
          user_count: {
            type: 'integer',
            description: 'Number of users in this hierarchy'
          },
          child_count: {
            type: 'integer',
            description: 'Number of child hierarchies'
          },
          children: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/HierarchyStructure'
            },
            description: 'Child hierarchies (for tree responses)'
          },
          metadata: {
            type: 'object',
            description: 'Additional hierarchy metadata'
          },
          created_at: {
            type: 'string',
            format: 'date-time'
          },
          updated_at: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      AccessScope: {
        type: 'object',
        properties: {
          user_id: {
            type: 'string',
            format: 'uuid',
            description: 'User ID for this access scope'
          },
          accessible_hierarchy_ids: {
            type: 'array',
            items: {
              type: 'string',
              format: 'uuid'
            },
            description: 'List of hierarchy IDs the user can access'
          },
          total_accessible_users: {
            type: 'integer',
            description: 'Total number of users the user can access'
          },
          effective_roles: {
            type: 'object',
            description: 'Mapping of hierarchy IDs to effective roles'
          },
          hierarchy_details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                path: { type: 'string' },
                user_count: { type: 'integer' },
                role: { type: 'string' },
                granted_at: { type: 'string', format: 'date-time' }
              }
            }
          },
          capabilities: {
            type: 'object',
            properties: {
              can_grant_permissions: { type: 'boolean' },
              can_create_users: { type: 'boolean' },
              can_modify_hierarchy: { type: 'boolean' },
              max_accessible_depth: { type: 'integer' }
            }
          }
        }
      },
      ApiResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: {
            type: 'boolean',
            description: 'Indicates if the request was successful'
          },
          data: {
            description: 'Response data (varies by endpoint)'
          },
          meta: {
            type: 'object',
            description: 'Additional metadata about the response'
          }
        }
      },
      PaginatedResponse: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                description: 'Array of data items'
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer', description: 'Current page number' },
                  limit: { type: 'integer', description: 'Items per page' },
                  total: { type: 'integer', description: 'Total number of items' },
                  pages: { type: 'integer', description: 'Total number of pages' }
                }
              }
            }
          }
        ]
      },
      ApiError: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          error: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Human-readable error message'
              },
              code: {
                type: 'string',
                description: 'Machine-readable error code'
              },
              statusCode: {
                type: 'integer',
                description: 'HTTP status code'
              },
              details: {
                description: 'Additional error details (optional)'
              }
            }
          }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          password: {
            type: 'string',
            description: 'User password'
          }
        }
      },
      AuthResponse: {
        type: 'object',
        properties: {
          user: {
            $ref: '#/components/schemas/User'
          },
          token: {
            type: 'string',
            description: 'JWT access token'
          },
          refreshToken: {
            type: 'string',
            description: 'Refresh token for obtaining new access tokens'
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            description: 'Access token expiration time'
          }
        }
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApiError'
            },
            example: {
              success: false,
              error: {
                message: 'Authentication required',
                code: 'UNAUTHORIZED',
                statusCode: 401
              }
            }
          }
        }
      },
      ForbiddenError: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApiError'
            }
          }
        }
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApiError'
            }
          }
        }
      },
      ValidationError: {
        description: 'Request validation failed',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApiError'
            }
          }
        }
      },
      RateLimitError: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApiError'
            }
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and token management'
    },
    {
      name: 'Users',
      description: 'User management operations'
    },
    {
      name: 'Permissions',
      description: 'Permission and access control management'
    },
    {
      name: 'Hierarchy',
      description: 'Organizational hierarchy management'
    },
    {
      name: 'Query',
      description: 'Advanced user queries and analytics'
    },
    {
      name: 'Health',
      description: 'System health and monitoring'
    }
  ]
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/models/*.ts'
  ]
};

export const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;