import { useEffect, useRef } from 'react';
import * as GL from 'golden-layout';
import { createRoot } from 'react-dom/client';
import CodeEditor from './CodeEditor';

function Tabs({ files = [{ fileName: 'App.jsx' }, { fileName: 'Other.jsx' }] }) {
  const containerRef = useRef(null);
  const layoutRef = useRef(null);

  useEffect(() => {
    const config = {
      settings: {
        hasHeaders: true,
        popoutWholeStack: false,
        showPopoutIcon: false,
        showMaximiseIcon: false
      },
      content: [
        {
          type: 'stack',
          content: files.map((f) => ({
            type: 'component',
            componentName: 'nestedEditor',
            title: f.fileName,
            componentState: { fileName: f.fileName },
            isClosable: true
          }))
        }
      ]
    };

    const layout = new GL.GoldenLayout(config, containerRef.current);
    layoutRef.current = layout;

    layout.registerComponent('nestedEditor', (container, componentState) => {
      const mountPoint = document.createElement('div');
      mountPoint.style.width = '100%';
      mountPoint.style.height = '100%';
      container.getElement().appendChild(mountPoint);
      const root = createRoot(mountPoint);

      root.render(<CodeEditor fileName={componentState.fileName} />);

      container.on('destroy', () => {
        setTimeout(() => root.unmount(), 0);
      });
    });

    layout.init();

    return () => {
      try {
        layout.destroy();
      } catch (e) {
        // ignore
      }
    };
  }, [files]);

  return <div ref={containerRef} className="koda-nested-tabs" style={{ width: '100%', height: '100%' }} />;
}

export { Tabs };
export default Tabs;
