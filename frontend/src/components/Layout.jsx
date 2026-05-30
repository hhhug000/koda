import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as GL from 'golden-layout';
import 'golden-layout/dist/css/goldenlayout-base.css';
import '../styles/layout.scss';

// golden-layout publishes a named `GoldenLayout` export; avoid checking `GL.default`
// because Vite will warn if a `default` export does not exist.
const GoldenLayout = GL.GoldenLayout ?? GL;

export const Layout = ({ config, components }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const layout = new GoldenLayout(config, containerRef.current);

    Object.entries(components).forEach(([componentName, Component]) => {
      layout.registerComponent(componentName, (container, componentState) => {
        const mountPoint = document.createElement('div');
        mountPoint.style.width = '100%';
        mountPoint.style.height = '100%';
        container.getElement().appendChild(mountPoint);
        const root = createRoot(mountPoint);
        let unmounted = false;

        const unmountRoot = () => {
          if (unmounted) {
            return;
          }

          unmounted = true;
          window.setTimeout(() => {
            root.unmount();
          }, 0);
        };

        root.render(<Component {...componentState} />);

        container.on('destroy', () => {
          unmountRoot();
        });
      });
    });

    layout.init();
    return () => layout.destroy();
  }, [components, config]);

  return <div ref={containerRef} className="gl-root" style={{ width: '100%', height: '100vh' }} />;
};