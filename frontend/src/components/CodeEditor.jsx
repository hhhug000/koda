import { useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { parse } from '@babel/parser';
import { Icon } from './Icon';
import '../styles/codeeditor.scss';

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

function CodeEditor({ fileName = 'App.jsx', initialCode = DEFAULT_CODE }) {
    const [source, setSource] = useState(initialCode);
    const [cursorPosition, setCursorPosition] = useState(null);

    const breadcrumbs = useMemo(() => buildBreadcrumbs(source, cursorPosition, fileName), [source, cursorPosition, fileName]);

    const editorOptions = useMemo(() => ({
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        automaticLayout: true
    }), []);

    const handleMount = (editor) => {
        setCursorPosition(editor.getPosition());

        editor.onDidChangeCursorPosition((event) => {
            setCursorPosition(event.position);
        });
    };

    return (
        <div className="editor-panel">
            <div className="editor-breadcrumbs" aria-label="Breadcrumbs">
                {breadcrumbs.map((crumb, index) => (
                    <span className="editor-breadcrumb" key={`${crumb.label}-${index}`}>
                        {index > 0 && <span className="editor-breadcrumb-separator">&gt;</span>}
                        {crumb.icon && <Icon name={crumb.icon} />}
                        <span className="editor-breadcrumb-label">{crumb.label}</span>
                    </span>
                ))}
            </div>
            <Editor
                height="100%"
                defaultLanguage="javascript"
                value={source}
                onChange={(nextValue) => setSource(nextValue ?? '')}
                onMount={handleMount}
                options={editorOptions}
            />
        </div>
    );
}

export default CodeEditor;