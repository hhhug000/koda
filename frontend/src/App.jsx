import { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Layout } from './components/Layout';
import MenuBar from './components/MenuBar'
import './styles/main.scss';
import Tabs from './components/Tabs';
import useCommunicator from './components/Communicator';
import useTheme from './hooks/useTheme';
import Explorer from './components/Explorer';
import TerminalPanel from './components/TerminalPanel';

// ── Layout config builder ─────────────────────────────────────────────────────

const GL_BASE = {
  settings: { hasHeaders: false, popoutWholeStack: true, showPopoutIcon: false, showMaximiseIcon: false },
  dimensions: { borderWidth: 4 },
};

function buildConfig({ left, terminal, right }) {
  const editorItem = { type: 'component', componentName: 'midEditor', componentState: { files: [] } };

  const center = terminal
    ? {
        type: 'column',
        content: [
          { ...editorItem, height: 65 },
          { type: 'component', componentName: 'midTopB', height: 35 },
        ],
      }
    : editorItem;

  if (!left && !right) {
    return { ...GL_BASE, content: [center] };
  }

  const sideW = 20;
  const centerW = 100 - ((left ? 1 : 0) + (right ? 1 : 0)) * sideW;
  const rowContent = [];
  if (left) rowContent.push({ type: 'component', componentName: 'left', width: sideW });
  rowContent.push({ ...center, width: centerW });
  if (right) rowContent.push({ type: 'component', componentName: 'right', width: sideW });

  return { ...GL_BASE, content: [{ type: 'row', content: rowContent }] };
}

// ── Layout presets (panels only — config derived via buildConfig) ──────────────

export const PRESETS = {
  default:  { label: 'Default',  panels: { left: true,  terminal: true,  right: true  } },
  focus:    { label: 'Focus',    panels: { left: false, terminal: false, right: false } },
  explorer: { label: 'Explorer', panels: { left: true,  terminal: false, right: false } },
  terminal: { label: 'Terminal', panels: { left: false, terminal: true,  right: false } },
  compact:  { label: 'Compact',  panels: { left: true,  terminal: true,  right: false } },
  wide:     { label: 'Wide',     panels: { left: true,  terminal: false, right: true  } },
};

export const PRESET_DEFS = Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label, panels: p.panels }));

// ── Panel components ──────────────────────────────────────────────────────────

function GlobalContextMenu() {
  const [menu, setMenu] = useState(null);
  const [adjustedPos, setAdjustedPos] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      const { x, y, items } = e.detail ?? {};
      if (!items || items.length === 0) return;
      setAdjustedPos(null);
      setMenu({ x, y, items });
    };
    window.addEventListener('koda.context-menu', handler);
    return () => window.removeEventListener('koda.context-menu', handler);
  }, []);

  useEffect(() => {
    if (menu && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setAdjustedPos({
        top: menu.y + rect.height > vh ? Math.max(0, menu.y - rect.height) : menu.y,
        left: menu.x + rect.width > vw ? Math.max(0, menu.x - rect.width) : menu.x,
      });
    }
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onMouseDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setMenu(null);
    };
    const onKeyDown = (e) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menu]);

  if (!menu) return null;

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{
        top: adjustedPos?.top ?? menu.y,
        left: adjustedPos?.left ?? menu.x,
        visibility: adjustedPos ? 'visible' : 'hidden',
      }}
      role="menu"
    >
      {menu.items.map((item, i) =>
        item === null ? (
          <div key={i} className="context-menu-separator" />
        ) : (
          <button
            key={i}
            className={`context-menu-item${item.disabled ? ' disabled' : ''}`}
            onClick={() => { if (!item.disabled) { item.action(); setMenu(null); } }}
            role="menuitem"
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

const LeftPanel   = () => <div className="pane-content" style={{ padding: 0 }}><Explorer /></div>;
const MiddleEditor = ({ files }) => <Tabs files={files ?? []} />;
const MiddleTopB  = () => <TerminalPanel />;
const RightPanel  = () => <div className="pane-content">Right Panel</div>;

const components = {
  left: LeftPanel,
  midEditor: MiddleEditor,
  midTopB: MiddleTopB,
  right: RightPanel,
};

// ── Stable element factory ────────────────────────────────────────────────────

function createStablePanels() {
  const make = (jsx) => {
    const div = document.createElement('div');
    div.style.cssText = 'width:100%;height:100%';
    createRoot(div).render(jsx);
    return div;
  };
  return {
    left:      make(<LeftPanel />),
    midEditor: make(<MiddleEditor files={[]} />),
    midTopB:   make(<MiddleTopB />),
    right:     make(<RightPanel />),
  };
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const { loading } = useTheme();

  const [activePanels, setActivePanels] = useState(PRESETS.default.panels);

  const layoutConfig = useMemo(() => buildConfig(activePanels), [activePanels]);

  const stableRef = useRef(null);
  if (stableRef.current === null) {
    stableRef.current = createStablePanels();
  }

  const handleMessage = (message) => {
    if (message?.type === 'fs-changed') {
      window.dispatchEvent(new CustomEvent('koda.fs-changed'));
    }
  };
  useCommunicator(handleMessage);

  if (loading) return <div>Loading theme...</div>;

  return (
    <div className="app-container">
      <MenuBar
        presetDefs={PRESET_DEFS}
        activePanels={activePanels}
        onPanelToggle={(key) => setActivePanels(prev => ({ ...prev, [key]: !prev[key] }))}
        onPresetSelect={(id) => setActivePanels({ ...PRESETS[id].panels })}
      />
      <Layout
        config={layoutConfig}
        components={components}
        stableElements={stableRef.current}
      />
      <GlobalContextMenu />
    </div>
  );
}

export default App;
