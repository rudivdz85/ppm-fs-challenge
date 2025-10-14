/**
 * AccessScopeCard component - displays user's access scope and capabilities
 */

import React from 'react';
import type { AccessScope } from '../services/api';

interface AccessScopeCardProps {
  accessScope: AccessScope;
  loading?: boolean;
  className?: string;
}

export const AccessScopeCard: React.FC<AccessScopeCardProps> = ({
  accessScope,
  loading = false,
  className = '',
}) => {
  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-yellow-100 text-yellow-800';
      case 'read':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getHighestRole = () => {
    const roles = Object.values(accessScope.effective_roles);
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('manager')) return 'manager';
    if (roles.includes('read')) return 'read';
    return 'none';
  };

  const roleCounts = Object.values(accessScope.effective_roles).reduce((acc, role) => {
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const highestRole = getHighestRole();

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Access Scope</h3>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getRoleBadgeColor(highestRole)}`}>
            {highestRole === 'none' ? 'No Access' : `Highest: ${highestRole.charAt(0).toUpperCase() + highestRole.slice(1)}`}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-700">
              {accessScope.accessible_hierarchy_ids.length}
            </div>
            <div className="text-sm text-blue-600">Accessible Hierarchies</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-700">
              {accessScope.total_accessible_users.toLocaleString()}
            </div>
            <div className="text-sm text-green-600">Accessible Users</div>
          </div>
        </div>

        {/* Role Distribution */}
        {Object.keys(roleCounts).length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Role Distribution</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(roleCounts).map(([role, count]) => (
                <span
                  key={role}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(role)}`}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Capabilities */}
        {accessScope.capabilities && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Capabilities</h4>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Grant Permissions</span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  accessScope.capabilities.can_grant_permissions 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {accessScope.capabilities.can_grant_permissions ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Create Users</span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  accessScope.capabilities.can_create_users 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {accessScope.capabilities.can_create_users ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Modify Hierarchy</span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  accessScope.capabilities.can_modify_hierarchy 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {accessScope.capabilities.can_modify_hierarchy ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Max Access Depth</span>
                <span className="text-sm font-medium text-gray-900">
                  {accessScope.capabilities.max_accessible_depth} levels
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Hierarchy Details */}
        {accessScope.hierarchy_details.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Accessible Hierarchies</h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {accessScope.hierarchy_details.map((hierarchy) => (
                <div
                  key={hierarchy.id}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-medium text-gray-900 truncate">
                        {hierarchy.name}
                      </h5>
                      <p className="text-xs text-gray-500 mt-1">{hierarchy.path}</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="text-xs text-gray-500">
                          {hierarchy.user_count} users
                        </span>
                        <span className="text-xs text-gray-500">
                          Granted: {new Date(hierarchy.granted_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(hierarchy.role)}`}>
                      {hierarchy.role.charAt(0).toUpperCase() + hierarchy.role.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {accessScope.accessible_hierarchy_ids.length === 0 && (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Access</h3>
            <p className="mt-1 text-sm text-gray-500">
              You don't have access to any hierarchies yet. Contact your administrator to request permissions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccessScopeCard;