/**
 * HierarchyTree component - displays organizational structure as an expandable tree
 */

import React, { useState } from 'react';
import type { HierarchyStructure } from '../services/api';

interface HierarchyTreeProps {
  data: HierarchyStructure;
  onNodeSelect?: (node: HierarchyStructure) => void;
  onNodeEdit?: (node: HierarchyStructure) => void;
  onNodeDelete?: (node: HierarchyStructure) => void;
  onAddChild?: (parentNode: HierarchyStructure) => void;
  selectedNodeId?: string;
  expandedNodes?: Set<string>;
  onToggleExpand?: (nodeId: string) => void;
  showActions?: boolean;
  level?: number;
}

interface TreeNodeProps extends HierarchyTreeProps {
  node: HierarchyStructure;
  level: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  onNodeSelect,
  onNodeEdit,
  onNodeDelete,
  onAddChild,
  selectedNodeId,
  expandedNodes = new Set(),
  onToggleExpand,
  showActions = true,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggleExpand?.(node.id);
    }
  };

  const getDepthColor = (depth: number) => {
    const colors = [
      'border-l-blue-500',
      'border-l-green-500',
      'border-l-yellow-500',
      'border-l-purple-500',
      'border-l-red-500',
      'border-l-indigo-500',
    ];
    return colors[depth % colors.length];
  };

  return (
    <div className="select-none">
      <div
        className={`flex items-center py-2 px-3 rounded-lg cursor-pointer transition-colors duration-150 ${
          isSelected
            ? 'bg-blue-100 border-l-4 border-l-blue-500'
            : 'hover:bg-gray-50 border-l-4 border-transparent'
        } ${level > 0 ? 'ml-6' : ''}`}
        onClick={() => onNodeSelect?.(node)}
        style={{ marginLeft: level * 24 }}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={handleToggleExpand}
          className={`mr-2 p-1 rounded transition-transform duration-200 ${
            hasChildren ? 'text-gray-600 hover:bg-gray-200' : 'text-transparent'
          }`}
          disabled={!hasChildren}
        >
          {hasChildren && (
            <svg
              className={`w-4 h-4 transform transition-transform duration-200 ${
                isExpanded ? 'rotate-90' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>

        {/* Node Icon */}
        <div className="mr-3">
          {hasChildren ? (
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h2M7 3v18M15 3v18" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
        </div>

        {/* Node Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className={`text-sm font-medium truncate ${
                isSelected ? 'text-blue-900' : 'text-gray-900'
              }`}>
                {node.name}
              </h3>
              <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                <span>Path: {node.path}</span>
                {node.user_count !== undefined && (
                  <span>Users: {node.user_count}</span>
                )}
                {node.child_count !== undefined && (
                  <span>Children: {node.child_count}</span>
                )}
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    node.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {node.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Actions */}
            {showActions && (
              <div className="flex items-center space-x-1 ml-2">
                {onAddChild && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddChild(node);
                    }}
                    className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                    title="Add child"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                )}
                {onNodeEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNodeEdit(node);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {onNodeDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNodeDelete(node);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render Children */}
      {hasChildren && isExpanded && (
        <div className="mt-1">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onNodeSelect={onNodeSelect}
              onNodeEdit={onNodeEdit}
              onNodeDelete={onNodeDelete}
              onAddChild={onAddChild}
              selectedNodeId={selectedNodeId}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              showActions={showActions}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const HierarchyTree: React.FC<HierarchyTreeProps> = ({
  data,
  onNodeSelect,
  onNodeEdit,
  onNodeDelete,
  onAddChild,
  selectedNodeId,
  expandedNodes: controlledExpandedNodes,
  onToggleExpand: controlledToggleExpand,
  showActions = true,
  level = 0,
}) => {
  const [internalExpandedNodes, setInternalExpandedNodes] = useState<Set<string>>(new Set([data.id]));

  const expandedNodes = controlledExpandedNodes || internalExpandedNodes;
  const onToggleExpand = controlledToggleExpand || ((nodeId: string) => {
    const newExpanded = new Set(internalExpandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setInternalExpandedNodes(newExpanded);
  });

  // Helper function to expand all nodes
  const expandAll = () => {
    const getAllNodeIds = (node: HierarchyStructure): string[] => {
      let ids = [node.id];
      if (node.children) {
        node.children.forEach(child => {
          ids = ids.concat(getAllNodeIds(child));
        });
      }
      return ids;
    };

    const allNodeIds = getAllNodeIds(data);
    setInternalExpandedNodes(new Set(allNodeIds));
  };

  // Helper function to collapse all nodes
  const collapseAll = () => {
    setInternalExpandedNodes(new Set([data.id]));
  };

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h2M7 3v18M15 3v18" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hierarchy data</h3>
          <p className="mt-1 text-sm text-gray-500">No organizational structure to display.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header with controls */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Organizational Structure</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={expandAll}
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              Expand All
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={collapseAll}
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Tree Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        <TreeNode
          node={data}
          level={0}
          onNodeSelect={onNodeSelect}
          onNodeEdit={onNodeEdit}
          onNodeDelete={onNodeDelete}
          onAddChild={onAddChild}
          selectedNodeId={selectedNodeId}
          expandedNodes={expandedNodes}
          onToggleExpand={onToggleExpand}
          showActions={showActions}
        />
      </div>
    </div>
  );
};

export default HierarchyTree;