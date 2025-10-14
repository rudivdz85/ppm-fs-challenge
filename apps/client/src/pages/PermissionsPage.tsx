/**
 * Permissions page - manage user permissions
 */

import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { User, Permission, HierarchyStructure, ApiError } from '../services/api';
import { PermissionForm } from '../components/PermissionForm';
import type { PermissionFormData } from '../components/PermissionForm';

export const PermissionsPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [hierarchies, setHierarchies] = useState<HierarchyStructure[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'grant' | 'update' | 'revoke'>('grant');
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterHierarchy, setFilterHierarchy] = useState<string>('');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadUserPermissions();
    }
  }, [selectedUser]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersResponse, hierarchiesResponse] = await Promise.all([
        apiService.getUsers({ limit: 100 }),
        apiService.getHierarchies({ limit: 100 }),
      ]);

      setUsers(usersResponse.data);
      setHierarchies(hierarchiesResponse.data);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadUserPermissions = async () => {
    if (!selectedUser) return;

    try {
      const userPermissions = await apiService.getUserPermissions(selectedUser.id);
      setPermissions(userPermissions);
    } catch (err) {
      console.error('Failed to load user permissions:', err);
    }
  };

  const handleGrantPermission = () => {
    setFormMode('grant');
    setSelectedPermission(null);
    setShowForm(true);
  };

  const handleUpdatePermission = (permission: Permission) => {
    setFormMode('update');
    setSelectedPermission(permission);
    setShowForm(true);
  };

  const handleRevokePermission = (permission: Permission) => {
    setFormMode('revoke');
    setSelectedPermission(permission);
    setShowForm(true);
  };

  const handleFormSubmit = async (data: PermissionFormData) => {
    try {
      setFormLoading(true);

      if (formMode === 'grant') {
        await apiService.grantPermission(data);
      } else if (formMode === 'update' && selectedPermission) {
        await apiService.updatePermission(selectedPermission.id, data);
      } else if (formMode === 'revoke' && selectedPermission) {
        await apiService.revokePermission(selectedPermission.id);
      }

      // Reload permissions
      await loadUserPermissions();
      setShowForm(false);
    } catch (err) {
      const apiError = err as ApiError;
      throw new Error(apiError.message || 'Operation failed');
    } finally {
      setFormLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredPermissions = permissions.filter(permission => {
    const matchesRole = !filterRole || permission.role === filterRole;
    const matchesHierarchy = !filterHierarchy || permission.hierarchy_id === filterHierarchy;
    return matchesRole && matchesHierarchy;
  });

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading permissions data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Permission Management</h1>
              <p className="mt-2 text-gray-600">
                Grant, update, and revoke user permissions across your organization
              </p>
            </div>
            <button
              onClick={handleGrantPermission}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              disabled={!selectedUser}
            >
              Grant Permission
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error Loading Data</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={loadInitialData}
                  className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Users List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Select User</h3>
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <p>No users found</p>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedUser?.id === user.id
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                          <span className="text-xs font-medium text-white">
                            {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{user.full_name}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Permissions List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedUser ? `${selectedUser.full_name}'s Permissions` : 'User Permissions'}
                  </h3>
                  {selectedUser && (
                    <button
                      onClick={handleGrantPermission}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                    >
                      Grant Permission
                    </button>
                  )}
                </div>

                {/* Permission Filters */}
                {selectedUser && permissions.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Roles</option>
                      <option value="read">Read</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                    <select
                      value={filterHierarchy}
                      onChange={(e) => setFilterHierarchy(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Hierarchies</option>
                      {hierarchies.map((hierarchy) => (
                        <option key={hierarchy.id} value={hierarchy.id}>
                          {hierarchy.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="p-6">
                {!selectedUser ? (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No user selected</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Select a user from the list to view and manage their permissions.
                    </p>
                  </div>
                ) : filteredPermissions.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No permissions found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      This user doesn't have any permissions yet.
                    </p>
                    <button
                      onClick={handleGrantPermission}
                      className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Grant First Permission
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPermissions.map((permission) => (
                      <div
                        key={permission.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <h4 className="text-sm font-medium text-gray-900">
                                {permission.hierarchy_name}
                              </h4>
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(permission.role)}`}>
                                {permission.role.charAt(0).toUpperCase() + permission.role.slice(1)}
                              </span>
                              {permission.inherit_to_descendants && (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  Inherited
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{permission.hierarchy_path}</p>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                              <span>Granted: {new Date(permission.granted_at).toLocaleDateString()}</span>
                              {permission.expires_at && (
                                <span>Expires: {new Date(permission.expires_at).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleUpdatePermission(permission)}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="Update permission"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRevokePermission(permission)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Revoke permission"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Permission Form Modal */}
        {showForm && (
          <PermissionForm
            mode={formMode}
            user={selectedUser}
            permission={selectedPermission}
            hierarchies={hierarchies}
            onSubmit={handleFormSubmit}
            onCancel={() => setShowForm(false)}
            loading={formLoading}
          />
        )}
      </div>
    </div>
  );
};

export default PermissionsPage;