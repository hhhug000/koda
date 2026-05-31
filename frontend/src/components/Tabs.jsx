import { useEffect, useRef } from 'react';
import * as GL from 'golden-layout';
import { createRoot } from 'react-dom/client';
import CodeEditor from './CodeEditor';

function Tabs({ files = [{ fileName: 'App.jsx' }, { fileName: 'Other.jsx' }] }) {
  const containerRef = useRef(null);
  const layoutRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const hasFiles = files.length > 0;
    // Always include an `emptyState` component in the stack so the
    // layout never removes the stack when user tabs are closed. We'll
    // visually hide its tab when real files exist.
    const stackContent = files.map((f) => ({
      type: 'component',
      componentName: 'nestedEditor',
      title: f.fileName,
      componentState: { fileName: f.fileName },
      isClosable: true
    }));

    // append persistent emptyState
    stackContent.push({
      type: 'component',
      componentName: 'emptyState',
      title: 'empty',
      componentState: { empty: true },
      isClosable: false
    });

    const config = {
      settings: {
        // keep headers present for stability
        hasHeaders: true,
        popoutWholeStack: false,
        showPopoutIcon: false,
        showMaximiseIcon: false
      },
      content: [
        {
          type: 'stack',
          content: stackContent
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

    layout.registerComponent('emptyState', (container) => {
      const mountPoint = document.createElement('div');
      mountPoint.style.width = '100%';
      mountPoint.style.height = '100%';
      container.getElement().appendChild(mountPoint);
      const root = createRoot(mountPoint);

      root.render(<div className="koda-nested-tabs-empty" />);

      container.on('destroy', () => {
        setTimeout(() => root.unmount(), 0);
      });
    });

    layout.init();

    const hideEmptyTabElement = () => {
      if (!containerRef.current) return;

      const tabElements = containerRef.current.querySelectorAll('.lm_tab');
      tabElements.forEach((tab) => {
        const titleEl = tab.querySelector('.lm_title');
        if (!titleEl) return;
        const text = titleEl.textContent?.trim() ?? '';
        if (text === 'empty') {
          tab.style.display = 'none';
          tab.setAttribute('data-empty-tab', 'true');
        } else if (tab.getAttribute('data-empty-tab') === 'true') {
          tab.style.display = '';
          tab.removeAttribute('data-empty-tab');
        }
      });
    };

    // run on init and whenever DOM mutates
    hideEmptyTabElement();
    const tabMutationObserver = new MutationObserver(() => hideEmptyTabElement());
    if (containerRef.current) tabMutationObserver.observe(containerRef.current, { childList: true, subtree: true });

    const updateEmptyState = () => {
      if (!wrapperRef.current || !containerRef.current) {
        return;
      }

      const items = containerRef.current.querySelectorAll('.lm_item');
      const hasItems = items.length > 0;
      const hasOnlyEmpty = items.length === 1
        && items[0].querySelector('.koda-nested-tabs-empty');

      wrapperRef.current.classList.toggle('koda-nested-tabs--empty', !hasItems || hasOnlyEmpty);
    };

    updateEmptyState();
    const mutationObserver = new MutationObserver(() => {
      updateEmptyState();
      hideEmptyTabElement();
    });
    if (containerRef.current) {
      mutationObserver.observe(containerRef.current, { childList: true, subtree: true });
    }

    let resizeHandle = 0;
    const updateLayoutSize = () => {
      if (!containerRef.current) {
        return;
      }

      if (resizeHandle) {
        cancelAnimationFrame(resizeHandle);
      }

      resizeHandle = requestAnimationFrame(() => {
        if (!containerRef.current) {
          return;
        }

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

    updateLayoutSize();

    window.addEventListener('resize', updateLayoutSize);
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateLayoutSize)
      : null;

    if (resizeObserver && containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      mutationObserver.disconnect();
      tabMutationObserver.disconnect();
      window.removeEventListener('resize', updateLayoutSize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (resizeHandle) {
        cancelAnimationFrame(resizeHandle);
      }
      try {
        layout.destroy();
      } catch {
        // ignore
      }
    };
  }, [files]);

  return (
    <div ref={wrapperRef} className="koda-nested-tabs-wrapper">
      <div ref={containerRef} className="koda-nested-tabs" />
    </div>
  );
}

export { Tabs };
export default Tabs;
