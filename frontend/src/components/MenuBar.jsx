import { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import '../styles/menubar.scss';

const PANEL_TOGGLES = [
  { key: 'left',     label: 'Explorer' },
  { key: 'terminal', label: 'Terminal' },
  { key: 'right',    label: 'Right'    },
];

function LayoutThumb({ panels, large = false }) {
  const { left, terminal, right } = panels;
  return (
    <div className={`layout-thumb${large ? ' layout-thumb--large' : ''}`}>
      {left && <div className="lt-side" />}
      <div className="lt-main">
        <div className="lt-editor" />
        {terminal && <div className="lt-terminal" />}
      </div>
      {right && <div className="lt-side" />}
    </div>
  );
}

function MenuBar({ presetDefs = [], activePanels = {}, onPanelToggle, onPresetSelect }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Highlight whichever preset (if any) matches the current panel selection
  const activePresetId = presetDefs.find(p =>
    p.panels.left     === (activePanels.left     ?? false) &&
    p.panels.terminal === (activePanels.terminal ?? false) &&
    p.panels.right    === (activePanels.right    ?? false)
  )?.id ?? null;

  return (
    <div className="menubar">
      <div className="menubar-right">
        <div className="layout-picker-wrapper" ref={wrapperRef}>
          <button
            className={`menubar-btn${open ? ' menubar-btn--active' : ''}`}
            onClick={() => setOpen(v => !v)}
            title="Layout"
          >
            <Icon name="LayoutDashboard" size={15} />
          </button>

          {open && (
            <div className="layout-dropdown">

              {/* ── Live preview + panel toggles ── */}
              <div className="layout-custom">
                <LayoutThumb panels={activePanels} large />
                <div className="layout-toggles">
                  {PANEL_TOGGLES.map(({ key, label }) => (
                    <label key={key} className="layout-toggle">
                      <input
                        type="checkbox"
                        checked={!!activePanels[key]}
                        onChange={() => onPanelToggle(key)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="layout-section-divider" />

              {/* ── Preset grid ── */}
              <div className="layout-dropdown-grid">
                {presetDefs.map(preset => (
                  <button
                    key={preset.id}
                    className={`layout-preset-btn${activePresetId === preset.id ? ' layout-preset-btn--active' : ''}`}
                    onClick={() => { onPresetSelect(preset.id); setOpen(false); }}
                  >
                    <LayoutThumb panels={preset.panels} />
                    <span className="layout-preset-label">{preset.label}</span>
                  </button>
                ))}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MenuBar;
