import { Layout } from './components/Layout';
import MenuBar from './components/MenuBar'
import './styles/main.scss';
import CodeEditor from './components/CodeEditor';
import Tabs from './components/Tabs';

const LeftPanel = () => <div className="pane-content">Left Panel</div>;
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
  return (
    <div className="app-container">
      <MenuBar />
      <Layout config={layoutConfig} components={components} />
    </div>
  );
}

export default App;