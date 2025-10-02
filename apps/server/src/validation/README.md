# Validation Layer Documentation

The validation layer provides comprehensive input validation for the hierarchical permission system using Zod for runtime type checking and schema validation. This layer validates all incoming request data BEFORE it reaches the service layer.

## Architecture Overview

```
Request → Validation Middleware → Service Layer → Repository Layer → Database
```

- **Validation Middleware**: Validates request format, types, and constraints
- **Zod Schemas**: Define validation rules with automatic TypeScript types
- **Error Handling**: Returns clear, actionable error messages
- **Type Safety**: Provides validated, typed data to services

## Core Components

### 1. Validation Middleware (`middleware/validate.middleware.ts`)

**Purpose**: Express middleware factory for validating different parts of requests

**Key Functions**:
- `validate(config)` - Comprehensive validation for body, params, query
- `validateBody(schema)` - Validate request body only
- `validateParams(schema)` - Validate URL parameters only
- `validateQuery(schema)` - Validate query parameters only
- `validateTarget(schema, target)` - Validate specific request part

**Features**:
- Supports validating multiple request parts simultaneously
- Returns 400 status with detailed error messages
- Attaches validated data to `req.validatedData`
- Formats Zod errors into user-friendly messages
- Provides TypeScript type inference

**Usage Example**:
```typescript
import { validate, validateBody } from '../middleware/validate.middleware';
import { createUserSchema } from '../validation/user.validation';

// Validate request body
app.post('/users', validateBody(createUserSchema), (req, res) => {
  const validatedData = req.validatedData.body; // TypeScript typed
  // validatedData is guaranteed to match schema
});

// Validate multiple parts
app.get('/users/:id', validate({
  params: userIdParamSchema,
  query: queryUsersSchema
}), (req, res) => {
  const { params, query } = req.validatedData;
  // Both params and query are validated and typed
});
```

### 2. Authentication Validation (`validation/auth.validation.ts`)

**Purpose**: Validates login, registration, and password management requests

**Key Schemas**:
- `loginSchema` - Email and password validation
- `registerSchema` - User registration with strong password requirements
- `changePasswordSchema` - Password change with confirmation
- `forgotPasswordSchema` - Password reset initiation
- `resetPasswordSchema` - Password reset completion

**Password Requirements**:
- Minimum 8 characters, maximum 72 characters
- Must contain: uppercase letter, lowercase letter, number, special character
- Prevents common passwords and user info in password

**Example**:
```typescript
const loginSchema = z.object({
  email: z.string().email().transform(email => email.toLowerCase()),
  password: z.string().min(8).max(72)
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character')
});
```

### 3. User Validation (`validation/user.validation.ts`)

**Purpose**: Validates user management operations and queries

**Key Schemas**:
- `createUserSchema` - User creation with hierarchy assignment
- `updateUserSchema` - User profile updates
- `queryUsersSchema` - User search with pagination and filtering
- `bulkUserOperationSchema` - Bulk operations on multiple users
- `userActivityQuerySchema` - User activity logging queries

**Features**:
- Email format validation and normalization
- Phone number validation (international format)
- Hierarchy ID validation (UUID format)
- Search term sanitization
- Pagination validation (1-100 limit)
- Date range validation

**Example**:
```typescript
const queryUsersSchema = z.object({
  page: z.string().optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .pipe(z.number().int().min(1)),
  limit: z.string().optional()
    .transform(val => val ? parseInt(val, 10) : 20)
    .pipe(z.number().int().min(1).max(100)),
  search: z.string().max(100).optional(),
  hierarchy_id: z.string().uuid().optional()
});
```

### 4. Permission Validation (`validation/permission.validation.ts`)

**Purpose**: Validates permission granting, access control, and queries

**Key Schemas**:
- `grantPermissionSchema` - Permission granting with role validation
- `accessibleUsersQuerySchema` - Query for accessible users
- `permissionAccessCheckSchema` - Access permission validation
- `bulkPermissionOperationSchema` - Bulk permission operations

**Role System**:
- `read` - Basic read access
- `manager` - Can manage users and grant read/manager permissions
- `admin` - Full administrative access

**Features**:
- Role hierarchy validation
- Expiration date validation (must be future)
- Inheritance settings validation
- Bulk operation size limits (max 50 users)
- Advanced filtering with multiple criteria

**Example**:
```typescript
const grantPermissionSchema = z.object({
  user_id: z.string().uuid(),
  hierarchy_id: z.string().uuid(),
  role: z.enum(['read', 'manager', 'admin']),
  inherit_to_descendants: z.boolean().optional().default(true),
  expires_at: z.string().datetime().transform(val => new Date(val)).optional()
}).refine(data => {
  if (data.expires_at && data.expires_at <= new Date()) {
    return false;
  }
  return true;
}, { message: 'Expiration date must be in the future' });
```

### 5. Hierarchy Validation (`validation/hierarchy.validation.ts`)

**Purpose**: Validates hierarchy structure management

**Key Schemas**:
- `createStructureSchema` - New hierarchy node creation
- `moveStructureSchema` - Moving nodes with circular reference prevention
- `hierarchyTreeQuerySchema` - Tree queries with depth limits
- `hierarchyValidationSchema` - Integrity checking

**ltree Constraints**:
- Codes must be alphanumeric + underscores only
- Maximum 50 characters per segment
- Maximum 20 levels deep
- No reserved words (admin, root, system, etc.)

**Features**:
- ltree path format validation
- Circular reference prevention
- Hierarchy depth limits
- Code uniqueness validation
- Sort order validation (0-9999)

**Example**:
```typescript
const createStructureSchema = z.object({
  name: z.string().min(2).max(100)
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Invalid characters'),
  code: z.string().min(1).max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'ltree format required')
    .transform(code => code.toLowerCase()),
  parent_id: z.string().uuid().optional()
}).refine(data => {
  const reservedWords = ['admin', 'root', 'system'];
  return !reservedWords.includes(data.code.toLowerCase());
}, { message: 'Code cannot be reserved word' });
```

### 6. Query Validation (`validation/query.validation.ts`)

**Purpose**: Validates complex user queries and analytics requests

**Key Schemas**:
- `queryAccessibleUsersSchema` - **THE CORE FEATURE** - Complex user queries
- `userStatsQuerySchema` - Dashboard statistics
- `bulkUserQuerySchema` - Bulk user operations
- `analyticsQuerySchema` - Analytics and reporting
- `exportQuerySchema` - Data export with format options

**Advanced Features**:
- Multi-criteria filtering (search, role, hierarchy, dates)
- Hierarchy level filtering (comma-separated list)
- Date range validation with cross-validation
- Export format validation (CSV, JSON, XLSX)
- Query complexity estimation
- Performance tracking options

**Example**:
```typescript
const queryAccessibleUsersSchema = z.object({
  search: z.string().max(100).optional(),
  hierarchy_levels: z.string().optional()
    .transform(val => {
      if (!val) return undefined;
      return val.split(',').map(level => {
        const num = parseInt(level.trim(), 10);
        if (isNaN(num) || num < 0 || num > 20) {
          throw new Error('Invalid hierarchy level');
        }
        return num;
      });
    }),
  created_after: z.string().datetime().transform(val => new Date(val)).optional(),
  created_before: z.string().datetime().transform(val => new Date(val)).optional()
}).refine(data => {
  if (data.created_after && data.created_before && 
      data.created_after >= data.created_before) {
    return false;
  }
  return true;
}, { message: 'created_before must be after created_after' });
```

## Error Handling

### Validation Error Format

```typescript
{
  success: false,
  error: {
    message: "Request validation failed",
    code: "VALIDATION_ERROR",
    statusCode: 400,
    details: {
      errors: [
        {
          field: "email",
          message: "Must be a valid email address",
          code: "invalid_string",
          received: "invalid-email",
          expected: "valid email format"
        }
      ],
      errorCount: 1
    }
  },
  timestamp: "2024-01-01T12:00:00.000Z"
}
```

### Error Message Customization

The validation layer provides user-friendly error messages:

- **Type Errors**: "Expected string, received number"
- **Length Errors**: "Must be at least 8 characters long"
- **Format Errors**: "Must be a valid email address"
- **Enum Errors**: "Must be one of: read, manager, admin"
- **Custom Errors**: "Expiration date must be in the future"

## Shared Types with Frontend

All validation types are exported to `@ppm/types` for consistency:

```typescript
// Shared between frontend and backend
export interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  base_hierarchy_id: string;
  phone?: string;
  metadata?: Record<string, any>;
}

// Frontend can use same types for forms
const userForm: CreateUserRequest = {
  email: "user@example.com",
  password: "SecurePass123!",
  full_name: "John Doe",
  base_hierarchy_id: "hierarchy-uuid"
};
```

## Performance Considerations

### Validation Optimization

- **Early Validation**: Fail fast on first validation error
- **Schema Caching**: Zod schemas are compiled once and reused
- **Transform Efficiency**: Minimal data transformation overhead
- **Memory Usage**: No validation state stored between requests

### Query Complexity

```typescript
const queryValidationUtils = {
  estimateQueryComplexity: (query: any): 'low' | 'medium' | 'high' => {
    let complexity = 0;
    if (query.search) complexity += 2;
    if (query.hierarchy_levels?.length > 1) complexity += 1;
    if (query.include_descendants) complexity += 2;
    // ... more factors
    return complexity <= 2 ? 'low' : complexity <= 5 ? 'medium' : 'high';
  }
};
```

## Usage Examples

### Basic Route Validation

```typescript
import { validateBody, validateParams, validate } from '../validation';
import { createUserSchema, userIdParamSchema } from '../validation';

// Single validation
app.post('/users', validateBody(createUserSchema), createUser);

// Parameter validation
app.get('/users/:id', validateParams(userIdParamSchema), getUser);

// Multiple validations
app.put('/users/:id', validate({
  params: userIdParamSchema,
  body: updateUserSchema
}), updateUser);
```

### Complex Query Validation

```typescript
import { queryAccessibleUsersSchema } from '../validation';

app.get('/query/users', 
  validateQuery(queryAccessibleUsersSchema), 
  async (req: ValidatedRequest, res) => {
    const queryParams = req.validatedData.query;
    // queryParams is fully typed and validated
    
    const result = await queryService.queryUsers(
      req.user.id, 
      queryParams
    );
    
    res.json(result);
  }
);
```

### Custom Validation Logic

```typescript
import { z } from 'zod';

const customSchema = z.object({
  email: z.string().email(),
  hierarchy_id: z.string().uuid()
}).refine(async (data) => {
  // Custom async validation
  const hierarchy = await hierarchyRepo.findById(data.hierarchy_id);
  return hierarchy && hierarchy.is_active;
}, {
  message: "Hierarchy must exist and be active",
  path: ["hierarchy_id"]
});
```

## Integration with Services

The validation layer provides clean, typed data to services:

```typescript
// In controller
app.post('/permissions', 
  validateBody(grantPermissionSchema),
  async (req: ValidatedRequest, res) => {
    // Data is guaranteed to be valid and typed
    const grantRequest = req.validatedData.body;
    
    // Service receives clean, validated data
    const result = await permissionService.grantPermission(
      grantRequest,
      req.user.id
    );
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(result.error.statusCode).json(result.error);
    }
  }
);
```

## Testing Validation

### Unit Testing Schemas

```typescript
import { createUserSchema } from '../validation/user.validation';

describe('User Validation', () => {
  it('should validate correct user data', () => {
    const validData = {
      email: 'user@example.com',
      password: 'SecurePass123!',
      full_name: 'John Doe',
      base_hierarchy_id: 'valid-uuid'
    };
    
    const result = createUserSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
  
  it('should reject invalid email', () => {
    const invalidData = {
      email: 'invalid-email',
      // ... other fields
    };
    
    const result = createUserSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['email']);
  });
});
```

### Integration Testing

```typescript
import request from 'supertest';
import app from '../app';

describe('POST /users', () => {
  it('should return validation error for invalid data', async () => {
    const response = await request(app)
      .post('/users')
      .send({
        email: 'invalid-email',
        password: '123' // too short
      });
    
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.errors).toHaveLength(2);
  });
});
```

## Security Considerations

### Input Sanitization

- **XSS Prevention**: Search terms are sanitized to remove dangerous characters
- **SQL Injection**: All input is validated before reaching database layer
- **Path Traversal**: File paths are validated for safe characters only
- **Size Limits**: All input has maximum size constraints

### Data Validation

- **Type Safety**: Runtime type checking prevents type confusion attacks
- **Range Validation**: Numeric inputs are constrained to safe ranges
- **Format Validation**: Structured data (emails, UUIDs) must match exact patterns
- **Business Logic**: Complex validations prevent logical inconsistencies

## Future Enhancements

### Planned Features

- **Conditional Validation**: Rules that depend on other field values
- **Async Validation**: Database-dependent validation rules
- **Custom Validators**: Plugin system for domain-specific validation
- **Validation Caching**: Cache validation results for repeated requests
- **Rate Limiting**: Per-field validation rate limiting

### Performance Improvements

- **Schema Compilation**: Pre-compile schemas for faster validation
- **Parallel Validation**: Validate multiple fields concurrently
- **Streaming Validation**: Validate large payloads incrementally
- **Validation Profiling**: Monitor validation performance metrics

## Configuration

### Environment Variables

```env
# Validation settings
VALIDATION_MAX_REQUEST_SIZE=10mb
VALIDATION_TIMEOUT_MS=5000
VALIDATION_CACHE_ENABLED=true
VALIDATION_STRICT_MODE=true
```

### Validation Configuration

```typescript
export const validationConfig = {
  maxRequestSize: '10mb',
  timeoutMs: 5000,
  cacheEnabled: true,
  strictMode: true,
  customErrorMessages: true,
  includeStackTrace: false // Only in development
};
```