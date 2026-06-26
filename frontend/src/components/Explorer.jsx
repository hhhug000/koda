import { useEffect, useState, useRef, useCallback } from 'react';
import { Icon } from './Icon';
import '../styles/explorer.scss';

const DEFAULT_BACKEND_PORT = '5174';

function resolveApiUrl(apiPath) {
  const baseFromEnv = import.meta.env?.VITE_API_BASE;
  if (baseFromEnv) {
    return `${baseFromEnv.replace(/\/$/, '')}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
  }
  try {
    const loc = window.location;
    if (String(loc.port) === DEFAULT_BACKEND_PORT || loc.origin.includes(`:${DEFAULT_BACKEND_PORT}`)) {
      return apiPath;
    }
    return `${loc.protocol}//${loc.hostname}:${DEFAULT_BACKEND_PORT}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
  } catch {
    return apiPath;
  }
}

function getParentPath(filePath) {
  return filePath.replace(/[\\/][^\\/]+$/, '');
}

function dispatchContextMenu(x, y, items) {
  window.dispatchEvent(new CustomEvent('koda.context-menu', { detail: { x, y, items } }));
}

function FileRow({ node, depth = 0, onToggle, defaultOpen = false, onContextMenu, renamingPath, onRenameCommit, activePath }) {
  const isDir = node.type === 'dir';
  const [open, setOpen] = useState(defaultOpen);
  const isRenaming = renamingPath === node.path;
  const [renameValue, setRenameValue] = useState(node.name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isRenaming) setRenameValue(node.name);
  }, [isRenaming, node.name]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      const dotIdx = node.name.lastIndexOf('.');
      if (dotIdx > 0 && !isDir) {
        inputRef.current.setSelectionRange(0, dotIdx);
      } else {
        inputRef.current.select();
      }
    }
  }, [isRenaming, isDir, node.name]);

  const commit = () => onRenameCommit(node, renameValue.trim());

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') commit();
    else if (e.key === 'Escape') onRenameCommit(node, node.name);
  };

  const toggle = () => {
    if (isRenaming) return;
    if (!isDir) {
      window.dispatchEvent(new CustomEvent('koda.open-file', {
        detail: { filePath: node.path, fileName: node.name }
      }));
      return;
    }
    const next = !open;
    setOpen(next);
    if (onToggle) onToggle(node, next);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  return (
    <div className="explorer-row" style={{ paddingLeft: `${depth * 5}px` }}>
      <div
        className={`explorer-entry ${isDir ? 'explorer-dir' : 'explorer-file'}${activePath === node.path ? ' explorer-entry--active' : ''}`}
        onClick={toggle}
        onContextMenu={handleContextMenu}
        role={isDir ? 'button' : 'listitem'}
        tabIndex={0}
      >
        <span className="explorer-chevron">
          {isDir && <Icon name={open ? 'ChevronDown' : 'ChevronRight'} />}
        </span>
        <span className="explorer-icon">
          <Icon name={isDir ? (open ? 'folder-open' : 'folder') : 'file'} />
        </span>
        {isRenaming ? (
          <input
            ref={inputRef}
            className="explorer-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={commit}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="explorer-label">{node.name}</span>
        )}
      </div>
      {isDir && open && node.children && (
        <div className="explorer-children">
          {node.children.map((child) => (
            <FileRow
              key={child.path}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
              renamingPath={renamingPath}
              onRenameCommit={onRenameCommit}
              activePath={activePath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Explorer({ apiPath = '/api/fs/tree' }) {
  const apiUrl = resolveApiUrl(apiPath);
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [renamingPath, setRenamingPath] = useState(null);
  const [activePath, setActivePath] = useState(null);

  const refreshTree = useCallback(async () => {
    try {
      const res = await fetch(apiUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw new Error('Expected JSON');
      const data = await res.json();
      setTree(data);
    } catch (err) {
      setError(err.message || String(err));
    }
  }, [apiUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl, { cache: 'no-store' });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`Failed to fetch: ${res.status} ${res.statusText} - ${txt.slice(0, 200)}`);
        }
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await res.text().catch(() => '');
          throw new Error(`Expected JSON but received ${contentType || 'unknown'}: ${text.slice(0, 300)}`);
        }
        const data = await res.json();
        if (!cancelled) setTree(data);
      } catch (err) {
        if (!cancelled) setError(err.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiUrl]);

  useEffect(() => {
    const handler = (e) => setActivePath(e.detail?.filePath ?? null);
    window.addEventListener('koda.open-file', handler);
    window.addEventListener('koda.active-file-changed', handler);
    return () => {
      window.removeEventListener('koda.open-file', handler);
      window.removeEventListener('koda.active-file-changed', handler);
    };
  }, []);

  useEffect(() => {
    window.addEventListener('koda.fs-changed', refreshTree);
    return () => window.removeEventListener('koda.fs-changed', refreshTree);
  }, [refreshTree]);

  const startRename = useCallback((node) => setRenamingPath(node.path), []);

  const handleRenameCommit = useCallback(async (node, newName) => {
    setRenamingPath(null);
    if (!newName || newName === node.name) return;
    const res = await fetch(resolveApiUrl('/api/fs/rename'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: node.path, new_name: newName }),
    });
    if (res.ok) {
      refreshTree();
    } else {
      const body = await res.json().catch(() => ({}));
      window.alert(`Rename failed: ${body.error || res.statusText}`);
    }
  }, [refreshTree]);

  const doDelete = useCallback(async (node) => {
    const msg = node.type === 'dir'
      ? `Delete folder "${node.name}" and all its contents?`
      : `Delete "${node.name}"?`;
    if (!window.confirm(msg)) return;
    const res = await fetch(
      resolveApiUrl(`/api/fs/item?path=${encodeURIComponent(node.path)}`),
      { method: 'DELETE' }
    );
    if (res.ok) {
      refreshTree();
    } else {
      const body = await res.json().catch(() => ({}));
      window.alert(`Delete failed: ${body.error || res.statusText}`);
    }
  }, [refreshTree]);

  const doCopy = useCallback((node) => setClipboard({ node }), []);

  const doPaste = useCallback(async (targetNode) => {
    if (!clipboard) return;
    let destDir;
    if (!targetNode) {
      destDir = tree?.path;
    } else if (targetNode.type === 'dir') {
      destDir = targetNode.path;
    } else {
      destDir = getParentPath(targetNode.path);
    }
    if (!destDir) return;
    const res = await fetch(resolveApiUrl('/api/fs/copy'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src: clipboard.node.path, dest_dir: destDir }),
    });
    if (res.ok) {
      refreshTree();
    } else {
      const body = await res.json().catch(() => ({}));
      window.alert(`Paste failed: ${body.error || res.statusText}`);
    }
  }, [clipboard, tree, refreshTree]);

  const doDuplicate = useCallback(async (node) => {
    const res = await fetch(resolveApiUrl('/api/fs/duplicate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: node.path }),
    });
    if (res.ok) {
      refreshTree();
    } else {
      const body = await res.json().catch(() => ({}));
      window.alert(`Duplicate failed: ${body.error || res.statusText}`);
    }
  }, [refreshTree]);

  const doCopyPath = useCallback((node) => {
    navigator.clipboard.writeText(node.path).catch(() => {});
  }, []);

  const doCopyRelativePath = useCallback((node) => {
    if (!tree) return;
    const root = tree.path;
    let rel = node.path;
    if (rel.startsWith(root)) rel = rel.slice(root.length).replace(/^[\\/]/, '');
    navigator.clipboard.writeText(rel).catch(() => {});
  }, [tree]);

  const getMenuItems = useCallback((node) => {
    if (!node) {
      return [{ label: 'Paste', action: () => doPaste(null), disabled: !clipboard }];
    }

    const isFile = node.type === 'file';
    const items = [];

    if (isFile) {
      items.push({
        label: 'Open',
        action: () => window.dispatchEvent(
          new CustomEvent('koda.open-file', { detail: { filePath: node.path, fileName: node.name } })
        ),
      });
      items.push(null);
    }

    items.push({ label: 'Rename', action: () => startRename(node) });
    items.push({ label: 'Delete', action: () => doDelete(node) });
    items.push(null);
    items.push({ label: 'Copy', action: () => doCopy(node) });
    items.push({ label: 'Paste', action: () => doPaste(node), disabled: !clipboard });
    items.push({ label: 'Duplicate', action: () => doDuplicate(node) });
    items.push(null);
    items.push({ label: 'Copy Path', action: () => doCopyPath(node) });
    items.push({ label: 'Copy Relative Path', action: () => doCopyRelativePath(node) });

    return items;
  }, [clipboard, startRename, doDelete, doCopy, doPaste, doDuplicate, doCopyPath, doCopyRelativePath]);

  const handleContextMenu = useCallback((e, node) => {
    e.preventDefault();
    dispatchContextMenu(e.clientX, e.clientY, getMenuItems(node));
  }, [getMenuItems]);

  const handleExplorerContextMenu = useCallback((e) => {
    e.preventDefault();
    dispatchContextMenu(e.clientX, e.clientY, getMenuItems(null));
  }, [getMenuItems]);

  if (loading) return <div className="explorer-root">Loading…</div>;
  if (error) return <div className="explorer-root">Error: {error}</div>;

  return (
    <div className="explorer-root" role="tree" onContextMenu={handleExplorerContextMenu}>
      {tree ? (
        <FileRow
          node={tree}
          depth={0}
          defaultOpen={true}
          onContextMenu={handleContextMenu}
          renamingPath={renamingPath}
          onRenameCommit={handleRenameCommit}
          activePath={activePath}
        />
      ) : (
        <div>No files</div>
      )}
    </div>
  );
}
