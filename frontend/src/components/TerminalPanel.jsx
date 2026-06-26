import { useState, useCallback, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import TerminalInstance from './TerminalInstance';

let _nextId = 1;

export default function TerminalPanel() {
  const [terminals, setTerminals] = useState(() => {
    const id = _nextId++;
    return [{ id, label: 'Terminal 1' }];
  });
  const [activeId, setActiveId] = useState(() => terminals[0]?.id);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef(null);

  useEffect(() => {
    if (renamingId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const addTerminal = useCallback(() => {
    const id = _nextId++;
    setTerminals(prev => [...prev, { id, label: `Terminal ${id}` }]);
    setActiveId(id);
  }, []);

  const closeTerminal = useCallback((id) => {
    const next = terminals.filter(t => t.id !== id);
    if (next.length === 0) {
      const newId = _nextId++;
      setTerminals([{ id: newId, label: `Terminal ${newId}` }]);
      setActiveId(newId);
    } else {
      setTerminals(next);
      if (activeId === id) {
        const idx = terminals.findIndex(t => t.id === id);
        setActiveId(next[Math.min(idx, next.length - 1)].id);
      }
    }
  }, [terminals, activeId]);

  const startRename = useCallback((t) => {
    setRenamingId(t.id);
    setRenameValue(t.label);
  }, []);

  const commitRename = useCallback((id) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      setTerminals(prev => prev.map(t => t.id === id ? { ...t, label: trimmed } : t));
    }
    setRenamingId(null);
  }, [renameValue]);

  return (
    <div className="terminal-panel">
      <div className="terminal-content">
        {terminals.map(t => (
          <TerminalInstance
            key={t.id}
            terminalId={t.id}
            active={t.id === activeId}
          />
        ))}
      </div>

      <div className="terminal-sidebar">
        <div className="terminal-sidebar-list">
          {terminals.map(t => {
            const isRenaming = renamingId === t.id;
            return (
              <div
                key={t.id}
                className={`terminal-entry${t.id === activeId ? ' terminal-entry--active' : ''}`}
                onClick={() => !isRenaming && setActiveId(t.id)}
                title={isRenaming ? undefined : t.label}
              >
                <span className="terminal-entry-icon">
                  <Icon name="Terminal" size={14} />
                </span>

                {isRenaming ? (
                  <input
                    className="terminal-rename-input"
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(t.id);
                      else if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onBlur={() => commitRename(t.id)}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="terminal-entry-label">{t.label}</span>
                    <button
                      className="terminal-entry-action"
                      onClick={e => { e.stopPropagation(); startRename(t); }}
                      title="Rename"
                    >
                      <Icon name="Pencil" size={11} />
                    </button>
                    <button
                      className="terminal-entry-action"
                      onClick={e => { e.stopPropagation(); closeTerminal(t.id); }}
                      title="Close"
                    >
                      <Icon name="X" size={11} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <button className="terminal-new-btn" onClick={addTerminal} title="New Terminal">
          <Icon name="Plus" size={14} />
        </button>
      </div>
    </div>
  );
}
