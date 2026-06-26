import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5174';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

function readCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export default function TerminalInstance({ terminalId, active }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      theme: {
        background:    readCssVar('--bg-editor')   || '#162637',
        foreground:    readCssVar('--text-primary') || '#DBDDDE',
        cursor:        readCssVar('--accent')       || '#2563eb',
        cursorAccent:  readCssVar('--bg-editor')   || '#162637',
        selectionBackground: '#2563eb44',
        black:         '#1e2530',
        red:           '#f87171',
        green:         '#86efac',
        yellow:        '#fbbf24',
        blue:          '#7dd3fc',
        magenta:       '#a78bfa',
        cyan:          '#06b6d4',
        white:         '#DBDDDE',
        brightBlack:   '#969DA4',
        brightRed:     '#fca5a5',
        brightGreen:   '#4ade80',
        brightYellow:  '#facc15',
        brightBlue:    '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan:    '#22d3ee',
        brightWhite:   '#ffffff',
      },
      fontFamily: '"Cascadia Code", "Fira Code", "Consolas", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    setTimeout(() => fitAddon.fit(), 0);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const ws = new WebSocket(`${WS_BASE}/ws/terminal/${terminalId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const { cols, rows } = term;
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'output') term.write(msg.data);
      } catch {
        term.write(e.data);
      }
    };

    ws.onclose = () => {
      term.write('\r\n\x1b[2m[session closed]\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    const ro = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch { /* ignore during teardown */ }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      ws.close();
      term.dispose();
    };
  }, [terminalId]);

  useEffect(() => {
    if (active && fitAddonRef.current) {
      setTimeout(() => {
        try { fitAddonRef.current.fit(); } catch { /* ignore */ }
      }, 10);
    }
  }, [active]);

  return (
    <div
      ref={containerRef}
      className="terminal-instance"
      style={{ display: active ? 'block' : 'none' }}
    />
  );
}
