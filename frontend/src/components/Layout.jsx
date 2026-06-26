import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as GL from 'golden-layout';
import 'golden-layout/dist/css/goldenlayout-base.css';
import '../styles/layout.scss';

const GoldenLayout = GL.GoldenLayout ?? GL;

export const Layout = ({ config, components, stableElements }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const layout = new GoldenLayout(config, containerRef.current);

    let resizeHandle = 0;
    const updateLayoutSize = () => {
      if (!containerRef.current) return;
      if (resizeHandle) cancelAnimationFrame(resizeHandle);
      resizeHandle = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const { offsetWidth, offsetHeight } = containerRef.current;
        const { width, height } = containerRef.current.getBoundingClientRect();
        const nextWidth = offsetWidth || Math.ceil(width);
        const nextHeight = offsetHeight || Math.ceil(height);
        if (typeof layout.updateSize === 'function') {
          layout.updateSize(nextWidth, nextHeight);
        } else if (typeof layout.setSize === 'function') {
          layout.setSize(nextWidth, nextHeight);
        }
      });
    };

    // Register all components — prefer stable elements (no unmount on layout switch),
    // fall back to creating a fresh React root per GL container.
    const allNames = new Set([
      ...Object.keys(components || {}),
      ...Object.keys(stableElements || {}),
    ]);

    allNames.forEach((componentName) => {
      const stableEl = stableElements?.[componentName];
      const Component = components?.[componentName];

      layout.registerComponent(componentName, (container, componentState) => {
        if (stableEl) {
          // Reattach the already-mounted React tree — no remount, state preserved.
          stableEl.style.width = '100%';
          stableEl.style.height = '100%';
          container.getElement().appendChild(stableEl);
          container.on('destroy', () => stableEl.remove());
        } else if (Component) {
          const mountPoint = document.createElement('div');
          mountPoint.style.width = '100%';
          mountPoint.style.height = '100%';
          container.getElement().appendChild(mountPoint);
          const root = createRoot(mountPoint);
          let unmounted = false;
          const unmountRoot = () => {
            if (unmounted) return;
            unmounted = true;
            window.setTimeout(() => root.unmount(), 0);
          };
          root.render(<Component {...componentState} />);
          container.on('destroy', () => unmountRoot());
        }
      });
    });

    layout.init();
    updateLayoutSize();

    window.addEventListener('resize', updateLayoutSize);
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateLayoutSize)
      : null;
    if (resizeObserver && containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateLayoutSize);
      if (resizeObserver) resizeObserver.disconnect();
      if (resizeHandle) cancelAnimationFrame(resizeHandle);
      layout.destroy();
    };
  }, [components, config, stableElements]);

  return (
    <div
      ref={containerRef}
      className="gl-root"
      style={{ position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box' }}
    />
  );
};
