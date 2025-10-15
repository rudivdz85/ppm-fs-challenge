import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { User, HierarchyStructure } from '../services/api';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: (user: User) => void;
}

interface CreateUserData {
  email: string;
  password: string;
  full_name: string;
  base_hierarchy_id: string;
  phone: string;
  metadata: Record<string, any>;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onUserAdded,
}) => {
  const [formData, setFormData] = useState<CreateUserData>({
    email: '',
    password: '',
    full_name: '',
    base_hierarchy_id: '',
    phone: '',
    metadata: {},
  });
  const [hierarchies, setHierarchies] = useState<HierarchyStructure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHierarchies();
    }
  }, [isOpen]);

  const loadHierarchies = async () => {
    try {
      const data = await apiService.getHierarchies({
        page: 1,
        limit: 100,
        is_active: true,
      });
      console.log('Hierarchy response:', data);
      console.log('Hierarchy data type:', typeof data.data);
      console.log('Is array?:', Array.isArray(data.data));
      
      if (data.data && data.data.structures && Array.isArray(data.data.structures)) {
        setHierarchies(data.data.structures);
        if (data.data.structures.length === 0) {
          console.warn('No hierarchies found');
        }
      } else {
        console.error('Hierarchy data is not an array:', data.data);
        setHierarchies([]);
        setError('Invalid hierarchy data format');
      }
    } catch (err) {
      console.error('Failed to load hierarchies:', err);
      setHierarchies([]);
      setError('Failed to load hierarchies');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const newUser = await apiService.createUser(formData);
      onUserAdded(newUser);
      onClose();
      // Reset form
      setFormData({
        email: '',
        password: '',
        full_name: '',
        base_hierarchy_id: '',
        phone: '',
        metadata: {},
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add New User</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              id="full_name"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">Minimum 8 characters</p>
          </div>

          <div>
            <label htmlFor="base_hierarchy_id" className="block text-sm font-medium text-gray-700 mb-1">
              Hierarchy *
            </label>
            <select
              id="base_hierarchy_id"
              name="base_hierarchy_id"
              value={formData.base_hierarchy_id}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Hierarchy</option>
              {Array.isArray(hierarchies) && hierarchies.map((hierarchy) => (
                <option key={hierarchy.id} value={hierarchy.id}>
                  {hierarchy.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone (Optional)
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="+1234567890"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};