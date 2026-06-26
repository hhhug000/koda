import { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import MenuBar from './components/MenuBar'
import './styles/main.scss';
import Tabs from './components/Tabs';
import useCommunicator from './components/Communicator';
import useTheme from './hooks/useTheme';
import Explorer from './components/Explorer';
import TerminalPanel from './components/TerminalPanel';

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

const LeftPanel = () => (
  <div className="pane-content" style={{ padding: 0 }}>
    <Explorer />
  </div>
);
const MiddleEditor = ({ files }) => <Tabs files={files ?? []} />;
const MiddleTopB = () => <TerminalPanel />;
const RightPanel = () => <div className="pane-content">Right Panel</div>;

const layoutConfig = {
  settings: { hasHeaders: false, popoutWholeStack: true, showPopoutIcon: false, showMaximiseIcon: false },
  dimensions: { borderWidth: 4 },
  content: [{
    type: 'row',
    content: [
      { type: 'component', componentName: 'left', width: 20 },
      {
        type: 'column',
        width: 60,
        content: [
          { type: 'component', componentName: 'midEditor', componentState: { files: [] }, height: 50 },
          { type: 'component', componentName: 'midTopB', height: 50 }
        ]
      },
      { type: 'component', componentName: 'right', width: 20 }
    ]
  }]
};

const components = {
  left: LeftPanel,
  midEditor: MiddleEditor,
  midTopB: MiddleTopB,
  right: RightPanel
};

function App() {
  const { loading } = useTheme();
  const handleMessage = (message) => {
    if (message?.type === 'fs-changed') {
      window.dispatchEvent(new CustomEvent('koda.fs-changed'));
    }
  };
  useCommunicator(handleMessage);

  if (loading) return <div>Loading theme...</div>;

  return (
    <div className="app-container">
      <MenuBar />
      <Layout config={layoutConfig} components={components} />
      <GlobalContextMenu />
    </div>
  );
}

export default App;
