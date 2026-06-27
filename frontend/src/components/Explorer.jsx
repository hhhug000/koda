import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
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

// ── Tooltip popup (alert / confirm) ──────────────────────────────────────────

function ExplorerPopup({ message, pos, type, onClose, onConfirm }) {
  const popupRef = useRef(null);
  const [computed, setComputed] = useState(null);

  useLayoutEffect(() => {
    const el = popupRef.current;
    if (!el) return;
    const W = el.offsetWidth;
    const H = el.offsetHeight;
    const vW = window.innerWidth;
    const vH = window.innerHeight;
    const GAP = 12;
    const MARGIN = 8;

    const idealLeft = pos.x - W / 2;
    const left = Math.max(MARGIN, Math.min(idealLeft, vW - W - MARGIN));
    const fitsBelow = pos.y + GAP + H + MARGIN <= vH;
    const top = fitsBelow ? pos.y + GAP : Math.max(MARGIN, pos.y - GAP - H);
    const arrowLeft = Math.max(12, Math.min(pos.x - left, W - 12));
    setComputed({ top, left, arrowLeft, above: !fitsBelow });
  }, [pos]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const posStyle = computed
    ? { top: computed.top, left: computed.left }
    : { visibility: 'hidden', top: -9999, left: -9999 };

  return (
    <div
      ref={popupRef}
      className={`explorer-popup${computed?.above ? ' explorer-popup--above' : ''}`}
      style={posStyle}
    >
      {computed && <span className="explorer-popup-arrow" style={{ left: computed.arrowLeft }} />}
      <p className="explorer-popup-msg">{message}</p>
      <div className="explorer-popup-actions">
        {type === 'confirm' && (
          <button className="explorer-popup-btn explorer-popup-btn--cancel" onClick={onClose}>
            Cancel
          </button>
        )}
        <button
          className={`explorer-popup-btn ${type === 'confirm' ? 'explorer-popup-btn--danger' : 'explorer-popup-btn--ok'}`}
          onClick={type === 'confirm' ? onConfirm : onClose}
          autoFocus
        >
          {type === 'confirm' ? 'Delete' : 'OK'}
        </button>
      </div>
    </div>
  );
}

// ── Inline new-item input row ─────────────────────────────────────────────────

function NewItemInput({ type, depth, onCommit, onCancel }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const commit = () => {
    const name = value.trim();
    if (name) onCommit(name);
    else onCancel();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commit();
    else if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="explorer-row" style={{ paddingLeft: `${depth * 5}px` }}>
      <div className="explorer-entry">
        <span className="explorer-chevron" />
        <span className="explorer-icon">
          <Icon name={type === 'dir' ? 'folder' : 'file'} />
        </span>
        <input
          ref={inputRef}
          className="explorer-rename-input"
          value={value}
          placeholder={type === 'dir' ? 'folder name' : 'file name'}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

// ── File / folder row ─────────────────────────────────────────────────────────

function FileRow({
  node, depth = 0, onToggle, defaultOpen = false,
  onContextMenu, renamingPath, onRenameCommit, activePath,
  draggingPath, dragOverPath, onDragStart, onDragOver, onDrop, onDragEnd,
  newItemState, onNewItemCommit, onNewItemCancel,
}) {
  const isDir = node.type === 'dir';
  const [open, setOpen] = useState(defaultOpen);
  const isRenaming = renamingPath === node.path;
  const [renameValue, setRenameValue] = useState(node.name);
  const inputRef = useRef(null);

  const isDragging = draggingPath === node.path;
  const isDragOver = dragOverPath === node.path;
  const isNewItemTarget = isDir && newItemState?.parentPath === node.path;

  // Auto-expand when this directory is the new-item target
  useEffect(() => {
    if (isNewItemTarget && !open) setOpen(true);
  }, [isNewItemTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isRenaming) setRenameValue(node.name);
  }, [isRenaming, node.name]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      const dotIdx = node.name.lastIndexOf('.');
      if (dotIdx > 0 && !isDir) inputRef.current.setSelectionRange(0, dotIdx);
      else inputRef.current.select();
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

  const handleDragStart = (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.path);
    onDragStart(node);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(node);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop(node);
  };

  const cls = [
    'explorer-entry',
    isDir ? 'explorer-dir' : 'explorer-file',
    activePath === node.path ? 'explorer-entry--active' : '',
    isDragging ? 'explorer-entry--dragging' : '',
    isDragOver ? 'explorer-entry--drag-over' : '',
  ].filter(Boolean).join(' ');

  const sharedChildProps = {
    onToggle, onContextMenu, renamingPath, onRenameCommit, activePath,
    draggingPath, dragOverPath, onDragStart, onDragOver, onDrop, onDragEnd,
    newItemState, onNewItemCommit, onNewItemCancel,
  };

  return (
    <div className="explorer-row" style={{ paddingLeft: `${depth * 5}px` }}>
      <div
        className={cls}
        draggable={!isRenaming}
        onClick={toggle}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={() => onDragEnd()}
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

      {isDir && open && (
        <div className="explorer-children">
          {isNewItemTarget && (
            <NewItemInput
              type={newItemState.type}
              depth={depth + 1}
              onCommit={(name) => onNewItemCommit(node.path, newItemState.type, name)}
              onCancel={onNewItemCancel}
            />
          )}
          {node.children?.map((child) => (
            <FileRow
              key={child.path}
              node={child}
              depth={depth + 1}
              {...sharedChildProps}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Explorer root ─────────────────────────────────────────────────────────────

export default function Explorer({ apiPath = '/api/fs/tree' }) {
  const apiUrl = resolveApiUrl(apiPath);
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [renamingPath, setRenamingPath] = useState(null);
  const [activePath, setActivePath] = useState(null);
  const [alertPopup, setAlertPopup] = useState(null);
  const [confirmPopup, setConfirmPopup] = useState(null);
  const [draggingPath, setDraggingPath] = useState(null);
  const [dragOverPath, setDragOverPath] = useState(null);
  const [newItemState, setNewItemState] = useState(null); // { parentPath, type }
  const draggingNodeRef = useRef(null);
  const lastMenuPosRef = useRef({ x: 200, y: 200 });

  const showAlert = useCallback((message) => {
    setAlertPopup({ message, pos: { ...lastMenuPosRef.current } });
  }, []);

  const showConfirm = useCallback((message) => {
    return new Promise(resolve => {
      setConfirmPopup({ message, pos: { ...lastMenuPosRef.current }, resolve });
    });
  }, []);

  const closeAlert = useCallback(() => setAlertPopup(null), []);
  const closeConfirm = useCallback((result) => {
    setConfirmPopup(prev => { prev?.resolve(result); return null; });
  }, []);

  const refreshTree = useCallback(async () => {
    try {
      const res = await fetch(apiUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('Expected JSON');
      setTree(await res.json());
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
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          const text = await res.text().catch(() => '');
          throw new Error(`Expected JSON but received ${ct || 'unknown'}: ${text.slice(0, 300)}`);
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

  // ── New file / folder ───────────────────────────────────────────────────────

  const startNewItem = useCallback((parentPath, type) => {
    setNewItemState({ parentPath, type });
  }, []);

  const handleNewItemCommit = useCallback(async (parentPath, type, name) => {
    setNewItemState(null);
    const path = `${parentPath.replace(/[\\/]$/, '')}/${name}`;
    const res = await fetch(resolveApiUrl('/api/fs/create'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, type }),
    });
    if (res.ok) {
      await refreshTree();
      if (type === 'file') {
        window.dispatchEvent(new CustomEvent('koda.open-file', {
          detail: { filePath: path, fileName: name }
        }));
      }
    } else {
      const body = await res.json().catch(() => ({}));
      showAlert(`Could not create ${type === 'dir' ? 'folder' : 'file'}: ${body.error || res.statusText}`);
    }
  }, [refreshTree, showAlert]);

  const handleNewItemCancel = useCallback(() => setNewItemState(null), []);

  // ── Rename ──────────────────────────────────────────────────────────────────

  const startRename = useCallback((node) => setRenamingPath(node.path), []);

  const handleRenameCommit = useCallback(async (node, newName) => {
    setRenamingPath(null);
    if (!newName || newName === node.name) return;
    const res = await fetch(resolveApiUrl('/api/fs/rename'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: node.path, new_name: newName }),
    });
    if (res.ok) refreshTree();
    else {
      const body = await res.json().catch(() => ({}));
      showAlert(`Rename failed: ${body.error || res.statusText}`);
    }
  }, [refreshTree, showAlert]);

  // ── Delete ──────────────────────────────────────────────────────────────────

  const doDelete = useCallback(async (node) => {
    const msg = node.type === 'dir'
      ? `Delete folder "${node.name}" and all its contents?`
      : `Delete "${node.name}"?`;
    if (!await showConfirm(msg)) return;
    const res = await fetch(
      resolveApiUrl(`/api/fs/item?path=${encodeURIComponent(node.path)}`),
      { method: 'DELETE' }
    );
    if (res.ok) refreshTree();
    else {
      const body = await res.json().catch(() => ({}));
      showAlert(`Delete failed: ${body.error || res.statusText}`);
    }
  }, [refreshTree, showAlert, showConfirm]);

  // ── Copy / paste / duplicate ────────────────────────────────────────────────

  const doCopy = useCallback((node) => setClipboard({ node }), []);

  const doPaste = useCallback(async (targetNode) => {
    if (!clipboard) return;
    const destDir = !targetNode ? tree?.path
      : targetNode.type === 'dir' ? targetNode.path
      : getParentPath(targetNode.path);
    if (!destDir) return;
    const res = await fetch(resolveApiUrl('/api/fs/copy'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src: clipboard.node.path, dest_dir: destDir }),
    });
    if (res.ok) refreshTree();
    else {
      const body = await res.json().catch(() => ({}));
      showAlert(`Paste failed: ${body.error || res.statusText}`);
    }
  }, [clipboard, tree, refreshTree, showAlert]);

  const doDuplicate = useCallback(async (node) => {
    const res = await fetch(resolveApiUrl('/api/fs/duplicate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: node.path }),
    });
    if (res.ok) refreshTree();
    else {
      const body = await res.json().catch(() => ({}));
      showAlert(`Duplicate failed: ${body.error || res.statusText}`);
    }
  }, [refreshTree, showAlert]);

  const doCopyPath = useCallback((node) => {
    navigator.clipboard.writeText(node.path).catch(() => {});
  }, []);

  const doCopyRelativePath = useCallback((node) => {
    if (!tree) return;
    let rel = node.path;
    if (rel.startsWith(tree.path)) rel = rel.slice(tree.path.length).replace(/^[\\/]/, '');
    navigator.clipboard.writeText(rel).catch(() => {});
  }, [tree]);

  // ── Drag and drop ───────────────────────────────────────────────────────────

  const clearDragState = useCallback(() => {
    setDraggingPath(null);
    setDragOverPath(null);
    draggingNodeRef.current = null;
  }, []);

  const handleDragStart = useCallback((node) => {
    draggingNodeRef.current = node;
    setDraggingPath(node.path);
  }, []);

  const handleDragOver = useCallback((node) => {
    setDragOverPath(node.path);
  }, []);

  const handleDrop = useCallback(async (targetNode) => {
    const srcNode = draggingNodeRef.current;
    clearDragState();
    if (!srcNode || !targetNode || srcNode.path === targetNode.path) return;
    const destDir = targetNode.type === 'dir' ? targetNode.path : getParentPath(targetNode.path);
    if (getParentPath(srcNode.path) === destDir) return;
    if (srcNode.type === 'dir' && (
      destDir === srcNode.path ||
      destDir.startsWith(srcNode.path + '/') ||
      destDir.startsWith(srcNode.path + '\\')
    )) return;
    const res = await fetch(resolveApiUrl('/api/fs/move'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src: srcNode.path, dest_dir: destDir }),
    });
    if (res.ok) refreshTree();
    else {
      const body = await res.json().catch(() => ({}));
      showAlert(`Move failed: ${body.error || res.statusText}`);
    }
  }, [clearDragState, refreshTree, showAlert]);

  const handleDragEnd = useCallback(() => clearDragState(), [clearDragState]);

  const handleExplorerDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverPath(null);
  }, []);

  // ── Context menu ────────────────────────────────────────────────────────────

  const getMenuItems = useCallback((node) => {
    // Determine which directory "owns" this position
    const targetDir = !node ? tree?.path
      : node.type === 'dir' ? node.path
      : getParentPath(node.path);

    const items = [];

    items.push({ label: 'New File',   action: () => targetDir && startNewItem(targetDir, 'file') });
    items.push({ label: 'New Folder', action: () => targetDir && startNewItem(targetDir, 'dir') });

    if (!node) {
      items.push(null);
      items.push({ label: 'Paste', action: () => doPaste(null), disabled: !clipboard });
      return items;
    }

    items.push(null);

    if (node.type === 'file') {
      items.push({
        label: 'Open',
        action: () => window.dispatchEvent(new CustomEvent('koda.open-file', {
          detail: { filePath: node.path, fileName: node.name }
        })),
      });
      items.push(null);
    }

    items.push({ label: 'Rename',    action: () => startRename(node) });
    items.push({ label: 'Delete',    action: () => doDelete(node) });
    items.push(null);
    items.push({ label: 'Copy',      action: () => doCopy(node) });
    items.push({ label: 'Paste',     action: () => doPaste(node), disabled: !clipboard });
    items.push({ label: 'Duplicate', action: () => doDuplicate(node) });
    items.push(null);
    items.push({ label: 'Copy Path',          action: () => doCopyPath(node) });
    items.push({ label: 'Copy Relative Path', action: () => doCopyRelativePath(node) });

    return items;
  }, [clipboard, tree, startNewItem, startRename, doDelete, doCopy, doPaste, doDuplicate, doCopyPath, doCopyRelativePath]);

  const handleContextMenu = useCallback((e, node) => {
    e.preventDefault();
    lastMenuPosRef.current = { x: e.clientX, y: e.clientY };
    dispatchContextMenu(e.clientX, e.clientY, getMenuItems(node));
  }, [getMenuItems]);

  const handleExplorerContextMenu = useCallback((e) => {
    e.preventDefault();
    lastMenuPosRef.current = { x: e.clientX, y: e.clientY };
    dispatchContextMenu(e.clientX, e.clientY, getMenuItems(null));
  }, [getMenuItems]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <div className="explorer-root">Loading…</div>;
  if (error)   return <div className="explorer-root">Error: {error}</div>;

  const sharedRowProps = {
    onContextMenu: handleContextMenu,
    renamingPath,
    onRenameCommit: handleRenameCommit,
    activePath,
    draggingPath,
    dragOverPath,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
    onDragEnd: handleDragEnd,
    newItemState,
    onNewItemCommit: handleNewItemCommit,
    onNewItemCancel: handleNewItemCancel,
  };

  return (
    <div
      className="explorer-root"
      role="tree"
      onContextMenu={handleExplorerContextMenu}
      onDragLeave={handleExplorerDragLeave}
    >
      {tree ? (
        <FileRow node={tree} depth={0} defaultOpen={true} {...sharedRowProps} />
      ) : (
        <div>No files</div>
      )}

      {alertPopup && (
        <ExplorerPopup
          type="alert"
          message={alertPopup.message}
          pos={alertPopup.pos}
          onClose={closeAlert}
        />
      )}

      {confirmPopup && (
        <ExplorerPopup
          type="confirm"
          message={confirmPopup.message}
          pos={confirmPopup.pos}
          onClose={() => closeConfirm(false)}
          onConfirm={() => closeConfirm(true)}
        />
      )}
    </div>
  );
}
