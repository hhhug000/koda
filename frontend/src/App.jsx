import { Layout } from './components/Layout';
import MenuBar from './components/MenuBar'
import './styles/main.scss';
import Tabs from './components/Tabs';
import useCommunicator from './components/Communicator';
import useTheme from './hooks/useTheme';

import Explorer from './components/Explorer';

const LeftPanel = () => (
  <div className="pane-content" style={{ padding: 0 }}>
    <Explorer />
  </div>
);
const MiddleEditor = ({ files, fileName }) => {
  const filesProp = files ?? [{ fileName: fileName ?? 'App.jsx' }, { fileName: 'Other.jsx' }];
  return <Tabs files={filesProp} />;
};
const MiddleTopB = () => <div className="pane-content">Middle Top — Tab B</div>;
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
          {
            type: 'component',
            componentName: 'midEditor',
            componentState: { files: [{ fileName: 'App.jsx' }, { fileName: 'Other.jsx' }] },
            height: 50
          },
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
    console.log('App received message:', message);
  };

  useCommunicator(handleMessage);

  if (loading) {
    return <div>Loading theme...</div>;
  }

  return (
    <div className="app-container">
      <MenuBar />
      <Layout config={layoutConfig} components={components} />
    </div>
  );
}

export default App;