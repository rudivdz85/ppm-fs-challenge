/**
 * Hierarchy page - visualize and manage organizational structure
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import type { HierarchyStructure, ApiError } from '../services/api';
import { HierarchyTree } from '../components/HierarchyTree';

export const HierarchyPage: React.FC = () => {
  const navigate = useNavigate();
  const [hierarchyData, setHierarchyData] = useState<HierarchyStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<HierarchyStructure | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isCreateRootModalOpen, setIsCreateRootModalOpen] = useState(false);
  const [nodeToEdit, setNodeToEdit] = useState<HierarchyStructure | null>(null);
  const [nodeToDelete, setNodeToDelete] = useState<HierarchyStructure | null>(null);
  const [parentForNewChild, setParentForNewChild] = useState<HierarchyStructure | null>(null);

  useEffect(() => {
    loadHierarchyTree();
  }, []);

  const loadHierarchyTree = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const treeData = await apiService.getHierarchyTree({
        include_user_counts: true,
        include_inactive: false,
        max_depth: 10,
      });
      
      setHierarchyData(treeData);
      
      // Auto-expand root node
      if (treeData) {
        setExpandedNodes(new Set([treeData.id]));
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to load hierarchy');
    } finally {
      setLoading(false);
    }
  };

  const handleNodeSelect = (node: HierarchyStructure) => {
    setSelectedNode(node);
  };

  const handleToggleExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleNodeEdit = (node: HierarchyStructure) => {
    setNodeToEdit(node);
    setIsEditModalOpen(true);
  };

  const handleNodeDelete = (node: HierarchyStructure) => {
    setNodeToDelete(node);
    setIsDeleteConfirmOpen(true);
  };

  const handleAddChild = (parentNode: HierarchyStructure) => {
    setParentForNewChild(parentNode);
    setIsAddChildModalOpen(true);
  };

  const handleEditSubmit = async (data: { name: string; description?: string }) => {
    if (!nodeToEdit) return;
    
    try {
      await apiService.updateHierarchy(nodeToEdit.id, data);
      await loadHierarchyTree(); // Refresh the tree
      setIsEditModalOpen(false);
      setNodeToEdit(null);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to update hierarchy');
    }
  };

  const handleAddChildSubmit = async (data: { name: string; description?: string }) => {
    if (!parentForNewChild) return;
    
    try {
      await apiService.createHierarchy({
        ...data,
        parent_id: parentForNewChild.id
      });
      await loadHierarchyTree(); // Refresh the tree
      setIsAddChildModalOpen(false);
      setParentForNewChild(null);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to create hierarchy');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!nodeToDelete) return;
    
    try {
      await apiService.deleteHierarchy(nodeToDelete.id);
      await loadHierarchyTree(); // Refresh the tree
      setIsDeleteConfirmOpen(false);
      setNodeToDelete(null);
      if (selectedNode?.id === nodeToDelete.id) {
        setSelectedNode(null);
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to delete hierarchy');
    }
  };

  const handleViewUsers = (node: HierarchyStructure) => {
    // Navigate to users page filtered by this hierarchy
    navigate(`/users?hierarchy_id=${node.id}`);
  };

  const handleCreateRootSubmit = async (data: { name: string; description?: string }) => {
    try {
      await apiService.createHierarchy({
        ...data,
        // No parent_id for root structure
      });
      await loadHierarchyTree(); // Refresh the tree
      setIsCreateRootModalOpen(false);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to create root structure');
    }
  };

  const handleExportHierarchy = async () => {
    try {
      // Get the full hierarchy data
      const treeData = await apiService.getHierarchyTree({
        include_user_counts: true,
        include_inactive: false,
        max_depth: 20,
      });

      // Convert to JSON and download
      const dataStr = JSON.stringify(treeData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hierarchy-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to export hierarchy');
    }
  };

  const handleValidateIntegrity = async () => {
    try {
      // Call the validate integrity endpoint
      const response = await fetch('/api/hierarchy/validate-integrity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiService.getToken()}`
        },
        body: JSON.stringify({
          check_types: ["orphaned_nodes", "circular_references", "invalid_paths"],
          fix_issues: false
        })
      });

      const result = await response.json();
      
      if (result.success) {
        if (result.data.is_valid) {
          alert('✅ Hierarchy integrity check passed! No issues found.');
        } else {
          const issueCount = result.data.issues_found.length;
          const issueList = result.data.issues_found.map((issue: any) => 
            `- ${issue.type}: ${issue.description}`
          ).join('\n');
          alert(`⚠️ Found ${issueCount} integrity issues:\n\n${issueList}`);
        }
      } else {
        throw new Error('Validation failed');
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to validate hierarchy integrity');
    }
  };

  const getNodeStats = (node: HierarchyStructure) => {
    let totalUsers = node.user_count || 0;
    let totalNodes = 1;
    let maxDepth = node.depth || 0;

    const traverse = (n: HierarchyStructure) => {
      if (n.children && n.children.length > 0) {
        n.children.forEach(child => {
          totalUsers += child.user_count || 0;
          totalNodes += 1;
          maxDepth = Math.max(maxDepth, child.depth || 0);
          traverse(child);
        });
      }
    };

    if (node.children && node.children.length > 0) {
      traverse(node);
    }

    return { totalUsers, totalNodes, maxDepth };
  };

  const stats = hierarchyData ? getNodeStats(hierarchyData) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading organizational structure...</p>
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
              <h1 className="text-3xl font-bold text-gray-900">Organizational Hierarchy</h1>
              <p className="mt-2 text-gray-600">
                View and manage your organizational structure
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={loadHierarchyTree}
                className="bg-white text-gray-700 px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Refresh
              </button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                Add Structure
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="bg-blue-500 p-3 rounded-lg text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h2M7 3v18M15 3v18" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-bold text-gray-900">{stats.totalNodes}</h3>
                  <p className="text-sm text-gray-600">Total Structures</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="bg-green-500 p-3 rounded-lg text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</h3>
                  <p className="text-sm text-gray-600">Total Users</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="bg-purple-500 p-3 rounded-lg text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-bold text-gray-900">{stats.maxDepth}</h3>
                  <p className="text-sm text-gray-600">Max Depth</p>
                </div>
              </div>
            </div>
          </div>
        )}

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
                <h3 className="text-sm font-medium text-red-800">Error Loading Hierarchy</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={loadHierarchyTree}
                  className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Hierarchy Tree */}
          <div className="lg:col-span-2">
            {hierarchyData ? (
              <HierarchyTree
                data={hierarchyData}
                onNodeSelect={handleNodeSelect}
                onNodeEdit={handleNodeEdit}
                onNodeDelete={handleNodeDelete}
                onAddChild={handleAddChild}
                selectedNodeId={selectedNode?.id}
                expandedNodes={expandedNodes}
                onToggleExpand={handleToggleExpand}
                showActions={true}
              />
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h2M7 3v18M15 3v18" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hierarchy data</h3>
                <p className="mt-1 text-sm text-gray-500">No organizational structure found.</p>
              </div>
            )}
          </div>

          {/* Node Details */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Structure Details</h3>
              </div>
              <div className="p-6">
                {selectedNode ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">{selectedNode.name}</h4>
                      <p className="text-sm text-gray-500">{selectedNode.path}</p>
                    </div>

                    {selectedNode.description && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Description</label>
                        <p className="text-sm text-gray-900">{selectedNode.description}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Users</label>
                        <p className="text-sm text-gray-900">{selectedNode.user_count || 0}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Children</label>
                        <p className="text-sm text-gray-900">{selectedNode.child_count || 0}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Depth</label>
                        <p className="text-sm text-gray-900">{selectedNode.depth}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <p className="text-sm text-gray-900">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              selectedNode.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {selectedNode.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">Created</label>
                      <p className="text-sm text-gray-900">
                        {new Date(selectedNode.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Metadata</label>
                        <div className="mt-1 bg-gray-50 rounded-md p-3">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                            {JSON.stringify(selectedNode.metadata, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    <div className="pt-4 space-y-2">
                      <button 
                        onClick={() => handleViewUsers(selectedNode)}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
                      >
                        View Users
                      </button>
                      <button 
                        onClick={() => handleAddChild(selectedNode)}
                        className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm"
                      >
                        Add Child Structure
                      </button>
                      <button 
                        onClick={() => handleNodeEdit(selectedNode)}
                        className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm"
                      >
                        Edit Structure
                      </button>
                      {selectedNode.user_count === 0 && selectedNode.child_count === 0 && (
                        <button 
                          onClick={() => handleNodeDelete(selectedNode)}
                          className="w-full bg-red-100 text-red-700 px-4 py-2 rounded-md hover:bg-red-200 transition-colors text-sm"
                        >
                          Delete Structure
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h2M7 3v18M15 3v18" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No structure selected</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Select a structure from the tree to view details.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Hierarchy Actions */}
            <div className="mt-6 bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Actions</h3>
              </div>
              <div className="p-6 space-y-3">
                <button 
                  onClick={() => setIsCreateRootModalOpen(true)}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Root Structure
                </button>
                <button 
                  onClick={handleExportHierarchy}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Hierarchy
                </button>
                <button 
                  onClick={handleValidateIntegrity}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Validate Integrity
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Structure Modal */}
      {isEditModalOpen && nodeToEdit && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md bg-white rounded-lg shadow-lg">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Structure</h3>
              <p className="mt-1 text-sm text-gray-600">
                Editing: {nodeToEdit.name}
              </p>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleEditSubmit({
                name: formData.get('name') as string,
                description: formData.get('description') as string || undefined
              });
            }}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  defaultValue={nodeToEdit.name}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  id="description"
                  name="description"
                  defaultValue={nodeToEdit.description || ''}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setNodeToEdit(null);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Child Modal */}
      {isAddChildModalOpen && parentForNewChild && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md bg-white rounded-lg shadow-lg">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add Child Structure</h3>
              <p className="mt-1 text-sm text-gray-600">
                Parent: {parentForNewChild.name}
              </p>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleAddChildSubmit({
                name: formData.get('name') as string,
                description: formData.get('description') as string || undefined
              });
            }}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Create Structure
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddChildModalOpen(false);
                    setParentForNewChild(null);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && nodeToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md bg-white rounded-lg shadow-lg">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">Delete Structure</h3>
              <p className="mt-2 text-sm text-gray-600">
                Are you sure you want to delete <strong>{nodeToDelete.name}</strong>?
              </p>
              <p className="mt-1 text-xs text-red-600">
                This action cannot be undone. All child structures will also be deleted.
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setNodeToDelete(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Root Structure Modal */}
      {isCreateRootModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md bg-white rounded-lg shadow-lg">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">Create Root Structure</h3>
              <p className="mt-1 text-sm text-gray-600">
                Create a new top-level organizational structure.
              </p>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleCreateRootSubmit({
                name: formData.get('name') as string,
                description: formData.get('description') as string || undefined,
              });
            }}>
              <div className="mb-4">
                <label htmlFor="root-name" className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  id="root-name"
                  name="name"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="root-description" className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  id="root-description"
                  name="description"
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Create Root Structure
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateRootModalOpen(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HierarchyPage;