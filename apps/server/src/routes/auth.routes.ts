/**
 * Authentication routes
 * Handles login, registration, token refresh, and user profile
 */

import express from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { 
  loginSchema, 
  registerSchema, 
  refreshTokenSchema,
  changePasswordSchema,
  verifyPasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from '../validation/auth.validation';

const router = express.Router();
const authController = new AuthController();

/**
 * POST /api/auth/login
 * User login with email and password
 * 
 * @example
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123!"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "user": { "id": "uuid", "email": "user@example.com", ... },
 *     "token": "jwt-access-token",
 *     "refreshToken": "jwt-refresh-token",
 *     "expiresAt": "2024-01-02T12:00:00.000Z"
 *   }
 * }
 */
router.post('/login',
  validate({ body: loginSchema }),
  authController.login
);

/**
 * POST /api/auth/register
 * User registration with required information
 * 
 * @example
 * Request body:
 * {
 *   "email": "newuser@example.com",
 *   "password": "SecurePass123!",
 *   "full_name": "John Doe",
 *   "base_hierarchy_id": "hierarchy-uuid",
 *   "phone": "+1234567890"
 * }
 * 
 * Response: Same as login
 */
router.post('/register',
  validate({ body: registerSchema }),
  authController.register
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 * 
 * @example
 * Request body:
 * {
 *   "refresh_token": "refresh-jwt-token"
 * }
 * 
 * Response: New token pair with user info
 */
router.post('/refresh',
  validate({ body: refreshTokenSchema }),
  authController.refreshToken
);

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 * Requires: Bearer token in Authorization header
 * 
 * @example
 * Headers: Authorization: Bearer <access-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "user-uuid",
 *     "email": "user@example.com",
 *     "full_name": "John Doe",
 *     "hierarchy_path": "Company.Department.Team",
 *     "is_active": true,
 *     "created_at": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.get('/me',
  authenticate,
  authController.getCurrentUser
);

/**
 * POST /api/auth/change-password
 * Change user's password (requires current password)
 * Requires: Authentication
 * 
 * @example
 * Request body:
 * {
 *   "current_password": "oldpassword",
 *   "new_password": "NewSecurePass123!",
 *   "confirm_password": "NewSecurePass123!"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": { "message": "Password changed successfully" }
 * }
 */
router.post('/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword
);

/**
 * POST /api/auth/verify-password
 * Verify user's current password for sensitive operations
 * Requires: Authentication
 * 
 * @example
 * Request body:
 * {
 *   "password": "current-password"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "isValid": true,
 *     "message": "Password is correct"
 *   }
 * }
 */
router.post('/verify-password',
  authenticate,
  validate({ body: verifyPasswordSchema }),
  authController.verifyPassword
);

/**
 * POST /api/auth/forgot-password
 * Generate password reset token and send reset email
 * Public endpoint (no authentication required)
 * 
 * @example
 * Request body:
 * {
 *   "email": "user@example.com"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "message": "If an account with that email exists, a password reset link has been sent.",
 *     "expiresAt": "2024-01-01T13:00:00.000Z"
 *   }
 * }
 */
router.post('/forgot-password',
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword
);

/**
 * POST /api/auth/reset-password
 * Reset password using reset token
 * Public endpoint (no authentication required)
 * 
 * @example
 * Request body:
 * {
 *   "token": "reset-token-from-email",
 *   "new_password": "NewSecurePass123!",
 *   "confirm_password": "NewSecurePass123!"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": { "message": "Password reset successfully" }
 * }
 */
router.post('/reset-password',
  validate({ body: resetPasswordSchema }),
  authController.resetPassword
);

/**
 * POST /api/auth/logout
 * Logout user (for logging purposes in stateless JWT system)
 * Requires: Authentication
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": { "message": "Logged out successfully" }
 * }
 */
router.post('/logout',
  authenticate,
  authController.logout
);

export default router;