import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { parse } from '@babel/parser';
import { Icon } from './Icon';
import '../styles/codeeditor.scss';
import KEYBINDS from '../config/keybinds';

const EXTENSION_TO_LANGUAGE = {
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    mts: 'typescript',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    svg: 'xml',
    json: 'json',
    jsonc: 'json',
    md: 'markdown',
    markdown: 'markdown',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    kts: 'kotlin',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    ps1: 'powershell',
    sql: 'sql',
    r: 'r',
    lua: 'lua',
    dockerfile: 'dockerfile',
    toml: 'ini',
    ini: 'ini',
    vue: 'html',
};

function getLanguageFromFileName(name) {
    if (!name) return 'plaintext';
    const lower = name.toLowerCase();
    if (lower === 'dockerfile') return 'dockerfile';
    const ext = lower.split('.').pop();
    return EXTENSION_TO_LANGUAGE[ext] ?? 'plaintext';
}

const ICON_NAMES = {
    file: 'file',
    function: 'function',
    class: 'class',
    property: 'property',
    variable: 'variable',
    jsx: 'jsx'
};

const DEFAULT_CODE = `const layoutConfig = {
  settings: { hasHeaders: false, popoutWholeStack: true },
  dimensions: { borderWidth: 4 },
  content: [{
    type: 'row',
    content: [
      { type: 'component', componentName: 'left', title: 'Left', width: 20 },
      {
        type: 'column',
        width: 60,
        content: [
          { type: 'component', componentName: 'midTopA', title: 'Top A', height: 50 },
          { type: 'component', componentName: 'midTopB', title: 'Top B', height: 50 }
        ]
      },
      { type: 'component', componentName: 'right', title: 'Right', width: 20 }
    ]
  }]
};`;

function getPositionOffset(code, position) {
    const lines = code.split('\n');
    let offset = 0;

    for (let index = 0; index < position.lineNumber - 1; index += 1) {
        offset += lines[index]?.length ?? 0;
        offset += 1;
    }

    return offset + Math.max(0, position.column - 1);
}

function isNodeBeforeOrAt(node, offset) {
    return typeof node.start === 'number' && typeof node.end === 'number' && node.start <= offset && offset <= node.end;
}

function getNodeLabel(node) {
    if (!node) {
        return null;
    }

    switch (node.type) {
        case 'ArrayExpression':
        case 'ObjectExpression':
            return null;
        case 'Program':
            return ICON_NAMES.file;
        case 'FunctionDeclaration':
        case 'FunctionExpression':
        case 'ArrowFunctionExpression':
            return node.id?.name ?? 'function';
        case 'ClassDeclaration':
            return node.id?.name ?? 'class';
        case 'VariableDeclarator':
            return node.id?.name ?? 'variable';
        case 'ObjectProperty':
        case 'ClassProperty':
        case 'ClassMethod':
        case 'ObjectMethod': {
            const key = node.key;
            if (key?.type === 'Identifier') {
                return key.name;
            }
            if (key?.type === 'StringLiteral') {
                return key.value;
            }
            return 'property';
        }
        case 'JSXElement':
            return node.openingElement?.name?.name ?? 'jsx';
        case 'JSXFragment':
            return 'fragment';
        default:
            return null;
    }
}

function getNodeIcon(node) {
    if (!node) {
        return null;
    }

    switch (node.type) {
        case 'Program':
            return ICON_NAMES.file;
        case 'ArrayExpression':
        case 'ObjectExpression':
            return null;
        case 'FunctionDeclaration':
        case 'FunctionExpression':
        case 'ArrowFunctionExpression':
            return ICON_NAMES.function;
        case 'ClassDeclaration':
            return ICON_NAMES.class;
        case 'VariableDeclarator':
            return ICON_NAMES.variable;
        case 'ObjectProperty':
        case 'ClassProperty':
        case 'ClassMethod':
        case 'ObjectMethod':
            return ICON_NAMES.property;
        case 'JSXElement':
            return ICON_NAMES.jsx;
        default:
            return null;
    }
}

function collectPath(node, offset, trail = []) {
    if (!node || !isNodeBeforeOrAt(node, offset)) {
        return trail;
    }

    const nextTrail = [...trail, node];

    const childKeys = [
        'program', 'declarations', 'declaration', 'expression', 'body', 'body', 'arguments',
        'properties', 'elements', 'specifiers', 'object', 'property', 'value', 'init', 'test', 'alternate',
        'consequent', 'left', 'right', 'argument', 'openingElement', 'closingElement', 'children',
        'params', 'id', 'key'
    ];

    for (const key of childKeys) {
        const value = node[key];
        if (Array.isArray(value)) {
            for (const child of value) {
                const found = collectPath(child, offset, nextTrail);
                if (found.length > nextTrail.length) {
                    return found;
                }
            }
        } else if (value && typeof value.type === 'string') {
            const found = collectPath(value, offset, nextTrail);
            if (found.length > nextTrail.length) {
                return found;
            }
        }
    }

    return nextTrail;
}

function buildBreadcrumbs(code, cursorPosition, fileName) {
    const breadcrumbs = [
        { label: 'frontend', icon: null },
        { label: 'src', icon: null },
        { label: fileName, icon: ICON_NAMES.file }
    ];

    if (!code?.trim() || !cursorPosition) {
        return breadcrumbs;
    }

    try {
        const ast = parse(code, {
            sourceType: 'module',
            plugins: ['jsx']
        });
        const offset = getPositionOffset(code, cursorPosition);
        const path = collectPath(ast, offset).filter((node) => node.type !== 'Program');

        for (const node of path) {
            const label = getNodeLabel(node);
            if (!label) {
                continue;
            }

            const icon = getNodeIcon(node);
            breadcrumbs.push({ label, icon });
        }
    } catch {
        return breadcrumbs;
    }

    return breadcrumbs;
}

function parseMonacoKeybind(monaco, combo) {
    const parts = combo.split('+').map(p => p.trim());
    let result = 0;
    for (const part of parts) {
        const lower = part.toLowerCase();
        if (lower === 'ctrl' || lower === 'cmd') result |= monaco.KeyMod.CtrlCmd;
        else if (lower === 'shift') result |= monaco.KeyMod.Shift;
        else if (lower === 'alt') result |= monaco.KeyMod.Alt;
        else {
            const upper = part.toUpperCase();
            const code = monaco.KeyCode[`Key${upper}`];
            if (code !== undefined) result |= code;
        }
    }
    return result;
}

function CodeEditor({ fileName = 'App.jsx', initialCode = DEFAULT_CODE, filePath = null }) {
    const [source, setSource] = useState(initialCode);
    const [cursorPosition, setCursorPosition] = useState(null);
    const editorRef = useRef(null);
    const themeDataRef = useRef(null);
    const savedSourceRef = useRef(initialCode);
    const isDirtyRef = useRef(false);
    const monacoRef = useRef(null);
    const saveFileRef = useRef(null);

    // Load the Monaco theme data once on mount
    useEffect(() => {
        const loadTheme = async () => {
            try {
                const response = await fetch('http://localhost:5174/api/theme/default/monaco');
                const themeData = await response.json();
                themeDataRef.current = themeData;
                console.log('Monaco theme data loaded');
            } catch (error) {
                console.error('Failed to load Monaco theme:', error);
            }
        };

        loadTheme();
    }, []);

    // Resolve a backend API URL similar to Explorer (prefer VITE_API_BASE)
    function resolveApiUrl(apiPath) {
        const DEFAULT_BACKEND_PORT = '5174';
        const baseFromEnv = import.meta.env?.VITE_API_BASE;
        if (baseFromEnv) {
            return `${baseFromEnv.replace(/\/$/, '')}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
        }

        try {
            const loc = window.location;
            if (String(loc.port) === DEFAULT_BACKEND_PORT || loc.origin.includes(`:${DEFAULT_BACKEND_PORT}`)) {
                return apiPath;
            }
            return `${loc.protocol}//${loc.hostname}:${DEFAULT_BACKEND_PORT}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
        } catch {
            return apiPath;
        }
    }

    saveFileRef.current = async () => {
        if (!filePath || !editorRef.current) return;
        const content = editorRef.current.getValue();
        try {
            const res = await fetch(resolveApiUrl('/api/fs/file'), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: filePath, content }),
            });
            if (res.ok) {
                savedSourceRef.current = content;
                isDirtyRef.current = false;
                window.dispatchEvent(new CustomEvent('koda.dirty-changed', {
                    detail: { filePath, fileName, isDirty: false }
                }));
            }
        } catch (err) {
            console.error('Failed to save file:', err);
        }
    };

    const handleChange = (nextValue) => {
        const val = nextValue ?? '';
        setSource(val);
        if (!filePath) return;
        const dirty = val !== savedSourceRef.current;
        if (dirty !== isDirtyRef.current) {
            isDirtyRef.current = dirty;
            window.dispatchEvent(new CustomEvent('koda.dirty-changed', {
                detail: { filePath, fileName, isDirty: dirty }
            }));
        }
    };

    // If a filePath is provided, fetch the file contents from the backend.
    useEffect(() => {
        if (!filePath) return undefined;

        let cancelled = false;
        (async () => {
            try {
                const url = resolveApiUrl(`/api/fs/file?path=${encodeURIComponent(filePath)}`);
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    setSource(`// Failed to load file (${res.status}): ${text}`);
                    return;
                }

                const text = await res.text();
                if (!cancelled) {
                    const val = text ?? '';
                    setSource(val);
                    savedSourceRef.current = val;
                    isDirtyRef.current = false;
                    window.dispatchEvent(new CustomEvent('koda.dirty-changed', {
                        detail: { filePath, fileName, isDirty: false }
                    }));
                }
            } catch (err) {
                if (!cancelled) setSource(`// Error loading file: ${String(err)}`);
            }
        })();

        return () => { cancelled = true; };
    }, [filePath]);

    const breadcrumbs = useMemo(() => buildBreadcrumbs(source, cursorPosition, fileName), [source, cursorPosition, fileName]);

    const editorOptions = useMemo(() => ({
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        automaticLayout: true,
        contextmenu: false,
    }), []);

    const handleBeforeMount = (monaco) => {
        monacoRef.current = monaco;
        if (themeDataRef.current) {
            monaco.editor.defineTheme('koda-theme', themeDataRef.current);
        }
    };

    const contextMenuFiredRef = useRef(false);

    const buildEditorMenuItems = useCallback((editor) => {
        const t = (id) => () => editor.trigger('menu', id, null);
        const items = [
            { label: 'Cut',        action: t('editor.action.clipboardCutAction') },
            { label: 'Copy',       action: t('editor.action.clipboardCopyAction') },
            { label: 'Paste',      action: t('editor.action.clipboardPasteAction') },
            { label: 'Select All', action: t('editor.action.selectAll') },
            null,
            { label: 'Undo', action: t('undo') },
            { label: 'Redo', action: t('redo') },
        ];
        if (filePath) {
            items.push(null);
            items.push({ label: 'Save', action: () => saveFileRef.current?.() });
        }
        return items;
    }, [filePath]);

    const handleMount = (editorInstance, monaco) => {
        editorRef.current = editorInstance;
        setCursorPosition(editorInstance.getPosition());

        editorInstance.onDidChangeCursorPosition((event) => {
            setCursorPosition(event.position);
        });

        editorInstance.addCommand(
            parseMonacoKeybind(monaco, KEYBINDS.SAVE),
            () => saveFileRef.current?.()
        );

        editorInstance.onContextMenu((e) => {
            contextMenuFiredRef.current = true;
            setTimeout(() => { contextMenuFiredRef.current = false; }, 50);
            e.event.preventDefault();
            const be = e.event.browserEvent;
            window.dispatchEvent(new CustomEvent('koda.context-menu', {
                detail: { x: be.clientX, y: be.clientY, items: buildEditorMenuItems(editorInstance) }
            }));
        });
    };

    const handleEditorPanelContextMenu = (e) => {
        e.preventDefault();
        if (contextMenuFiredRef.current) return;
        if (!editorRef.current) return;
        window.dispatchEvent(new CustomEvent('koda.context-menu', {
            detail: { x: e.clientX, y: e.clientY, items: buildEditorMenuItems(editorRef.current) }
        }));
    };

    return (
        <div className="editor-panel" onContextMenu={handleEditorPanelContextMenu}>
            <div className="editor-breadcrumbs" aria-label="Breadcrumbs">
                {breadcrumbs.map((crumb, index) => (
                    <span className="editor-breadcrumb" key={`${crumb.label}-${index}`}>
                        {index > 0 && <span className="editor-breadcrumb-separator">&gt;</span>}
                        {crumb.icon && <Icon name={crumb.icon} />}
                        <span className="editor-breadcrumb-label">{crumb.label}</span>
                    </span>
                ))}
            </div>
            <div style={{ flex: '1 1 auto', minHeight: 0, minWidth: 0, width: '100%', height: '100%' }}>
                <Editor
                    height="100%"
                    width="100%"
                    language={getLanguageFromFileName(fileName)}
                    value={source}
                    onChange={handleChange}
                    onMount={handleMount}
                    beforeMount={handleBeforeMount}
                    options={editorOptions}
                    theme="koda-theme"
                />
            </div>
        </div>
    );
}

export default CodeEditor;