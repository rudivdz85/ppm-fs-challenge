/**
 * PermissionForm component - form for granting, updating, or revoking permissions
 */

import React, { useState, useEffect } from 'react';
import type { User, HierarchyStructure, Permission } from '../services/api';

interface PermissionFormProps {
  mode: 'grant' | 'update' | 'revoke';
  user?: User;
  permission?: Permission;
  hierarchies: HierarchyStructure[];
  onSubmit: (data: PermissionFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export interface PermissionFormData {
  user_id: string;
  hierarchy_id: string;
  role: 'read' | 'manager' | 'admin';
  inherit_to_descendants: boolean;
  expires_at?: string;
  metadata?: Record<string, any>;
}

export const PermissionForm: React.FC<PermissionFormProps> = ({
  mode,
  user,
  permission,
  hierarchies,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [formData, setFormData] = useState<PermissionFormData>({
    user_id: user?.id || permission?.user_id || '',
    hierarchy_id: permission?.hierarchy_id || '',
    role: permission?.role || 'read',
    inherit_to_descendants: permission?.inherit_to_descendants ?? true,
    expires_at: permission?.expires_at ? permission.expires_at.split('T')[0] : '',
    metadata: permission?.metadata || {},
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (permission) {
      setFormData({
        user_id: permission.user_id,
        hierarchy_id: permission.hierarchy_id,
        role: permission.role,
        inherit_to_descendants: permission.inherit_to_descendants,
        expires_at: permission.expires_at ? permission.expires_at.split('T')[0] : '',
        metadata: permission.metadata || {},
      });
    }
  }, [permission]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.user_id) {
      newErrors.user_id = 'User is required';
    }

    if (!formData.hierarchy_id) {
      newErrors.hierarchy_id = 'Hierarchy is required';
    }

    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    if (formData.expires_at) {
      const expiryDate = new Date(formData.expires_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (expiryDate <= today) {
        newErrors.expires_at = 'Expiry date must be in the future';
      }
    }

    if (mode === 'grant' && !reason.trim()) {
      newErrors.reason = 'Reason for granting permission is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submitData: PermissionFormData = {
      ...formData,
      expires_at: formData.expires_at ? `${formData.expires_at}T23:59:59.999Z` : undefined,
      metadata: {
        ...formData.metadata,
        ...(reason && { reason }),
      },
    };

    try {
      await onSubmit(submitData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'grant':
        return 'Grant Permission';
      case 'update':
        return 'Update Permission';
      case 'revoke':
        return 'Revoke Permission';
      default:
        return 'Permission Form';
    }
  };

  const getSubmitButtonText = () => {
    if (loading) {
      return mode === 'grant' ? 'Granting...' : mode === 'update' ? 'Updating...' : 'Revoking...';
    }
    return mode === 'grant' ? 'Grant Permission' : mode === 'update' ? 'Update Permission' : 'Revoke Permission';
  };

  const getSubmitButtonColor = () => {
    return mode === 'revoke' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
  };

  const selectedHierarchy = hierarchies.find(h => h.id === formData.hierarchy_id);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-lg bg-white rounded-lg shadow-lg">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900">{getTitle()}</h3>
          {user && (
            <p className="mt-1 text-sm text-gray-600">
              User: <span className="font-medium">{user.full_name} ({user.email})</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hierarchy Selection */}
          <div>
            <label htmlFor="hierarchy_id" className="block text-sm font-medium text-gray-700">
              Hierarchy Structure
            </label>
            <select
              id="hierarchy_id"
              value={formData.hierarchy_id}
              onChange={(e) => setFormData({ ...formData, hierarchy_id: e.target.value })}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                errors.hierarchy_id ? 'border-red-300' : ''
              }`}
              disabled={mode === 'revoke'}
            >
              <option value="">Select a hierarchy...</option>
              {hierarchies.map((hierarchy) => (
                <option key={hierarchy.id} value={hierarchy.id}>
                  {hierarchy.path} - {hierarchy.name}
                </option>
              ))}
            </select>
            {errors.hierarchy_id && (
              <p className="mt-1 text-sm text-red-600">{errors.hierarchy_id}</p>
            )}
            {selectedHierarchy && (
              <p className="mt-1 text-xs text-gray-500">
                Users in this hierarchy: {selectedHierarchy.user_count || 0}
              </p>
            )}
          </div>

          {/* Role Selection */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'read' | 'manager' | 'admin' })}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                errors.role ? 'border-red-300' : ''
              }`}
              disabled={mode === 'revoke'}
            >
              <option value="read">Read - View access only</option>
              <option value="manager">Manager - Can manage users and permissions</option>
              <option value="admin">Admin - Full administrative access</option>
            </select>
            {errors.role && (
              <p className="mt-1 text-sm text-red-600">{errors.role}</p>
            )}
          </div>

          {/* Inherit to Descendants */}
          <div className="flex items-center">
            <input
              id="inherit_to_descendants"
              type="checkbox"
              checked={formData.inherit_to_descendants}
              onChange={(e) => setFormData({ ...formData, inherit_to_descendants: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={mode === 'revoke'}
            />
            <label htmlFor="inherit_to_descendants" className="ml-2 block text-sm text-gray-900">
              Inherit to descendant hierarchies
            </label>
          </div>
          <p className="text-xs text-gray-500">
            When enabled, this permission will also apply to all child hierarchies under the selected structure.
          </p>

          {/* Expiry Date */}
          <div>
            <label htmlFor="expires_at" className="block text-sm font-medium text-gray-700">
              Expiry Date (Optional)
            </label>
            <input
              id="expires_at"
              type="date"
              value={formData.expires_at}
              onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                errors.expires_at ? 'border-red-300' : ''
              }`}
              disabled={mode === 'revoke'}
            />
            {errors.expires_at && (
              <p className="mt-1 text-sm text-red-600">{errors.expires_at}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Leave empty for permanent permission
            </p>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
              {mode === 'grant' ? 'Reason for granting' : mode === 'update' ? 'Reason for update' : 'Reason for revocation'} 
              {mode === 'grant' && <span className="text-red-500"> *</span>}
            </label>
            <textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`Enter reason for ${mode === 'grant' ? 'granting' : mode === 'update' ? 'updating' : 'revoking'} this permission...`}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                errors.reason ? 'border-red-300' : ''
              }`}
            />
            {errors.reason && (
              <p className="mt-1 text-sm text-red-600">{errors.reason}</p>
            )}
          </div>

          {/* Current Permission Details (for update/revoke) */}
          {(mode === 'update' || mode === 'revoke') && permission && (
            <div className="bg-gray-50 p-3 rounded-md">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Current Permission</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <p><span className="font-medium">Granted:</span> {new Date(permission.granted_at).toLocaleDateString()}</p>
                <p><span className="font-medium">Current Role:</span> {permission.role}</p>
                <p><span className="font-medium">Inherits:</span> {permission.inherit_to_descendants ? 'Yes' : 'No'}</p>
                {permission.expires_at && (
                  <p><span className="font-medium">Expires:</span> {new Date(permission.expires_at).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${getSubmitButtonColor()}`}
              disabled={loading}
            >
              {getSubmitButtonText()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PermissionForm;