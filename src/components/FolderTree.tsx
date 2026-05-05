import { useState, useCallback, useEffect, useRef } from "react";
import { useServerStore } from "@/stores";
import { listDirectory, executeWithTokenRefresh } from "@/services/openlist";
import type { FileInfo } from "@/types";

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  loaded: boolean; // 是否已加载子节点
  loading: boolean; // 是否正在加载
  expanded: boolean; // 是否展开
}

interface FolderTreeProps {
  selectedPath: string;
  onPathSelect: (path: string) => void;
  excludePaths?: string[]; // 排除的路径列表（源文件所在目录）
}

export function FolderTree({ selectedPath, onPathSelect, excludePaths = [] }: FolderTreeProps) {
  const { getActiveServer } = useServerStore();
  const rootNodeRef = useRef<FolderNode>({
    name: "根目录",
    path: "/",
    children: [],
    loaded: false,
    loading: false,
    expanded: true,
  });
  const [rootNode, setRootNode] = useState<FolderNode>(rootNodeRef.current);

  // 加载指定路径下的文件夹
  const loadFolders = useCallback(async (path: string): Promise<FolderNode[]> => {
    const server = getActiveServer();
    if (!server) return [];

    try {
      const response = await executeWithTokenRefresh(
        () => listDirectory(server.url, server.token, path)
      );
      // 只保留文件夹
      const folders = response.content
        .filter((item: FileInfo) => item.isDir)
        .map((item: FileInfo) => ({
          name: item.name,
          path: item.path || `${path}/${item.name}`.replace(/\/+/g, "/"),
          children: [],
          loaded: false,
          loading: false,
          expanded: false,
        }));
      return folders;
    } catch {
      return [];
    }
  }, [getActiveServer]);

  // 同步 ref 和 state 的辅助函数
  const updateRootNode = useCallback((updater: (prev: FolderNode) => FolderNode) => {
    setRootNode((prev) => {
      const next = updater(prev);
      rootNodeRef.current = next;
      return next;
    });
  }, []);

  // 初始加载根目录
  useEffect(() => {
    if (!rootNode.loaded && !rootNode.loading) {
      updateRootNode((prev) => ({ ...prev, loading: true }));
      loadFolders("/").then((children) => {
        updateRootNode(() => ({
          name: "根目录",
          path: "/",
          children,
          loaded: true,
          loading: false,
          expanded: true,
        }));
      });
    }
  }, [rootNode.loaded, rootNode.loading, loadFolders, updateRootNode]);

  // 查找指定路径的节点
  const findNode = (root: FolderNode, path: string): FolderNode | null => {
    if (root.path === path) return root;
    for (const child of root.children) {
      const found = findNode(child, path);
      if (found) return found;
    }
    return null;
  };

  // 展开/折叠节点
  const toggleNode = useCallback(async (nodePath: string) => {
    // 从 ref 中直接获取节点状态，避免闭包问题
    const targetNode = findNode(rootNodeRef.current, nodePath);
    if (!targetNode) return;

    const { loaded, loading } = targetNode;

    // 根据节点状态执行不同操作
    if (!loaded && !loading) {
      // 情况1：节点未加载且未加载中，需要加载
      // 先标记为加载中并展开
      updateRootNode((prev) => {
        const markLoading = (node: FolderNode): FolderNode => {
          if (node.path === nodePath) {
            return { ...node, loading: true, expanded: true };
          }
          return {
            ...node,
            children: node.children.map(markLoading),
          };
        };
        return markLoading(prev);
      });

      // 加载子节点
      const children = await loadFolders(nodePath);
      updateRootNode((prev) => {
        const updateNode = (node: FolderNode): FolderNode => {
          if (node.path === nodePath) {
            return {
              ...node,
              children,
              loaded: true,
              loading: false,
              expanded: true, // 加载完成后保持展开状态
            };
          }
          return {
            ...node,
            children: node.children.map(updateNode),
          };
        };
        return updateNode(prev);
      });
    } else if (loaded) {
      // 情况2：节点已加载，只需切换展开/折叠状态
      updateRootNode((prev) => {
        const toggleExpanded = (node: FolderNode): FolderNode => {
          if (node.path === nodePath) {
            return { ...node, expanded: !node.expanded };
          }
          return {
            ...node,
            children: node.children.map(toggleExpanded),
          };
        };
        return toggleExpanded(prev);
      });
    }
    // 情况3：节点正在加载中（loading: true），不做任何操作
  }, [loadFolders, updateRootNode]);

  // 递归渲染树节点
  const renderNode = useCallback((node: FolderNode, depth: number) => {
    const isExcluded = excludePaths.includes(node.path);
    const isSelected = selectedPath === node.path;
    const hasChildren = node.loaded && node.children.length > 0;
    const isLoading = node.loading;
    const canExpand = hasChildren || !node.loaded;

    return (
      <div key={node.path}>
        <div
          className={`folder-tree-item flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors duration-150 ${
            isSelected
              ? "bg-[var(--color-accent)] text-white"
              : isExcluded
              ? "opacity-40 cursor-not-allowed"
              : "hover:bg-[var(--color-github-surface-hover)]"
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (!isExcluded) {
              onPathSelect(node.path);
            }
          }}
        >
          {/* 展开/折叠图标 */}
          <button
            type="button"
            className="w-4 h-4 flex items-center justify-center shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              if (!isExcluded && canExpand) {
                toggleNode(node.path);
              }
            }}
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : canExpand ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-3 w-3 transition-transform duration-200 ${node.expanded ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>

          {/* 文件夹图标 */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-[var(--color-warning)]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>

          {/* 文件夹名称 */}
          <span className="text-sm truncate">{node.name}</span>
        </div>

        {/* 子节点 - 仅在展开时渲染 */}
        {node.expanded && hasChildren && (
          <div className="folder-tree-children">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }, [selectedPath, onPathSelect, excludePaths, toggleNode]);

  return (
    <div className="folder-tree border border-[var(--color-border)] rounded-lg p-2 bg-[var(--color-bg)] max-h-80 overflow-y-auto">
      {renderNode(rootNode, 0)}
    </div>
  );
}
