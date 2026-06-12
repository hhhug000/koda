import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import '../styles/explorer.scss';

function FileRow({ node, depth = 0, onToggle, defaultOpen = false }) {
  const isDir = node.type === 'dir';
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    if (!isDir) {
      window.dispatchEvent(
        new CustomEvent('koda.open-file', {
          detail: { filePath: node.path, fileName: node.name }
        })
      );
      return;
    }
    const next = !open;
    setOpen(next);
    if (onToggle) onToggle(node, next);
  };

  return (
    <div className="explorer-row" style={{ paddingLeft: `${depth * 12}px` }}>
      <div className={`explorer-entry ${isDir ? 'explorer-dir' : 'explorer-file'}`} onClick={toggle} role={isDir ? 'button' : 'listitem'} tabIndex={0}>
        <span className="explorer-icon">
          {isDir ? <Icon name={open ? 'folder-open' : 'folder'} /> : <Icon name="file" />}
        </span>
        <span className="explorer-label">{node.name}</span>
      </div>
      {isDir && open && node.children && (
        <div className="explorer-children">
          {node.children.map((child) => (
            <FileRow key={child.path} node={child} depth={depth + 1} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_BACKEND_PORT = '5174';

function resolveApiUrl(apiPath) {
  // If user provides Vite env var, use it. Otherwise, when running the dev
  // frontend server (commonly on :5173) assume backend on :5174.
  const baseFromEnv = import.meta.env?.VITE_API_BASE;
  if (baseFromEnv) {
    return `${baseFromEnv.replace(/\/$/, '')}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
  }

  try {
    const loc = window.location;
    // If the current origin already looks like the backend port, use relative path
    if (String(loc.port) === DEFAULT_BACKEND_PORT || loc.origin.includes(`:${DEFAULT_BACKEND_PORT}`)) {
      return apiPath;
    }

    // Otherwise assume backend runs on DEFAULT_BACKEND_PORT on same host.
    return `${loc.protocol}//${loc.hostname}:${DEFAULT_BACKEND_PORT}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
  } catch {
    return apiPath;
  }
}

export default function Explorer({ apiPath = '/api/fs/tree' }) {
  const apiUrl = resolveApiUrl(apiPath);
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          // Likely an HTML page (index.html) or error page — surface first chunk for debugging
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

  if (loading) return <div className="explorer-root">Loading…</div>;
  if (error) return <div className="explorer-root">Error: {error}</div>;

  return (
    <div className="explorer-root" role="tree">
      {tree ? (
        <FileRow node={tree} depth={0} defaultOpen={true} />
      ) : (
        <div>No files</div>
      )}
    </div>
  );
}
