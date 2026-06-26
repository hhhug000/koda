import asyncio
import shutil
import webview
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, Body, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import threading
import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_config_dir():
    """Get platform-specific config directory."""
    if sys.platform == 'win32':
        # Windows: %APPDATA%/koda
        config_dir = Path(os.getenv('APPDATA')) / 'koda'
    elif sys.platform == 'darwin':
        # macOS: ~/Library/Application Support/koda
        config_dir = Path.home() / 'Library' / 'Application Support' / 'koda'
    else:
        # Linux: $XDG_CONFIG_HOME/koda or ~/.config/koda
        xdg_config = os.getenv('XDG_CONFIG_HOME')
        if xdg_config:
            config_dir = Path(xdg_config) / 'koda'
        else:
            config_dir = Path.home() / '.config' / 'koda'
    
    return config_dir

def ensure_config():
    """Create config directory and files if they don't exist."""
    config_dir = get_config_dir()
    themes_dir = config_dir / 'themes'
    config_file = config_dir / 'config.json'
    
    config_dir.mkdir(parents=True, exist_ok=True)
    themes_dir.mkdir(parents=True, exist_ok=True)
    
    default_config = {
        "app": {
            "title": "Koda",
            "version": "1.0.0"
        },
        "server": {
            "host": "localhost",
            "port": 5174,
            "frontend_url": "http://localhost:5173"
        },
        "theme": {
            "current": "default",
            "available": ["default"]
        },
        "logging": {
            "level": "INFO",
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        }
    }
    
    if not config_file.exists():
        with open(config_file, 'w') as f:
            json.dump(default_config, f, indent=2)
        logger.info(f"Created config file at {config_file}")
    
    # Create default theme
    default_theme_dir = themes_dir / 'default'
    default_theme_dir.mkdir(parents=True, exist_ok=True)
    
    default_theme_css = """/* Default Theme */
:root {
  /* Base Colors */
  --bg-primary: #ffffff;
  --bg-surface: #151E2A;
  --bg-editor: #162637;
  --bg-menubar: linear-gradient(#223346, #151E2A);
  --bg-muted: #edf0f7;
  --text-primary: #DBDDDE;
  --text-secondary: #969DA4;
  --border-default: #384049;
  --border-strong: #b9c2d6;
  --accent: #2563eb;
  --accent-soft: #dbe7ff;
  --shadow: 0 10px 30px rgba(18, 24, 38, 0.08);
  --panel-radius: 0px;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  
  /* Syntax Highlighting - Keywords & Control Flow */
  --syntax-keyword: #7dd3fc;
  --syntax-control: #f97316;
  --syntax-function: #a78bfa;
  --syntax-variable: #e0e7ff;
  
  /* Syntax Highlighting - Data Types & Literals */
  --syntax-type: #86efac;
  --syntax-string: #fbbf24;
  --syntax-number: #fb923c;
  --syntax-boolean: #f87171;
  --syntax-null: #94a3b8;
  
  /* Syntax Highlighting - Comments & Operators */
  --syntax-comment: #64748b;
  --syntax-operator: #cbd5e1;
  --syntax-punctuation: #cbd5e1;
  
  /* Syntax Highlighting - Special Elements */
  --syntax-tag: #06b6d4;
  --syntax-attribute: #a78bfa;
  --syntax-property: #a78bfa;
  --syntax-regex: #fca5a5;
  --syntax-template-string: #fbbf24;
  
  /* Syntax Highlighting - Emphasis & Error */
  --syntax-emphasis: #ec4899;
  --syntax-error: #f87171;
  --syntax-warning: #f97316;
  --syntax-success: #86efac;
  --syntax-info: #06b6d4;
}

html[data-theme='midnight'] {
  --bg-primary: #0b1020;
  --bg-surface: #11182b;
  --bg-muted: #1a2440;
  --text-primary: #ecf2ff;
  --text-secondary: #aab7d6;
  --border-default: #2b3654;
  --border-strong: #40507b;
  --accent: #7dd3fc;
  --accent-soft: rgba(125, 211, 252, 0.12);
  --shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  
  /* Syntax Highlighting for Midnight Theme */
  --syntax-keyword: #60a5fa;
  --syntax-control: #f97316;
  --syntax-function: #c084fc;
  --syntax-variable: #d1d5db;
  
  --syntax-type: #4ade80;
  --syntax-string: #facc15;
  --syntax-number: #fb923c;
  --syntax-boolean: #ef4444;
  --syntax-null: #78716c;
  
  --syntax-comment: #4b5563;
  --syntax-operator: #9ca3af;
  --syntax-punctuation: #9ca3af;
  
  --syntax-tag: #22d3ee;
  --syntax-attribute: #d8b4fe;
  --syntax-property: #d8b4fe;
  --syntax-regex: #fca5a5;
  --syntax-template-string: #fbbf24;
  
  --syntax-emphasis: #f472b6;
  --syntax-error: #f87171;
  --syntax-warning: #fb923c;
  --syntax-success: #4ade80;
  --syntax-info: #22d3ee;
}
"""
    
    theme_css_file = default_theme_dir / 'theme.css'
    if not theme_css_file.exists():
        with open(theme_css_file, 'w') as f:
            f.write(default_theme_css)
        logger.info(f"Created default theme at {theme_css_file}")
    
    # Create Monaco theme JSON
    monaco_theme = {
        "base": "vs-dark",
        "inherit": True,
        "rules": [
            {"token": "keyword", "foreground": "7dd3fc"},
            {"token": "keyword.control", "foreground": "f97316"},
            {"token": "entity.name.function", "foreground": "a78bfa"},
            {"token": "support.function", "foreground": "a78bfa"},
            {"token": "variable", "foreground": "e0e7ff"},
            {"token": "variable.parameter", "foreground": "e0e7ff"},
            {"token": "entity.name.type", "foreground": "86efac"},
            {"token": "storage.type", "foreground": "86efac"},
            {"token": "support.type", "foreground": "86efac"},
            {"token": "string", "foreground": "fbbf24"},
            {"token": "string.quoted", "foreground": "fbbf24"},
            {"token": "string.template", "foreground": "fbbf24"},
            {"token": "constant.numeric", "foreground": "fb923c"},
            {"token": "constant.character.numeric", "foreground": "fb923c"},
            {"token": "constant.language.boolean", "foreground": "f87171"},
            {"token": "constant.language.null", "foreground": "94a3b8"},
            {"token": "comment", "foreground": "64748b"},
            {"token": "comment.line", "foreground": "64748b"},
            {"token": "comment.block", "foreground": "64748b"},
            {"token": "keyword.operator", "foreground": "cbd5e1"},
            {"token": "punctuation", "foreground": "cbd5e1"},
            {"token": "entity.name.tag", "foreground": "06b6d4"},
            {"token": "meta.tag", "foreground": "06b6d4"},
            {"token": "entity.other.attribute-name", "foreground": "a78bfa"},
            {"token": "support.type.property-name", "foreground": "a78bfa"},
            {"token": "string.regexp", "foreground": "fca5a5"},
        ],
        "colors": {
            "editor.background": "#162637",
            "editor.foreground": "#DBDDDE",
            "editorLineNumber.foreground": "#969DA4",
            "editor.selectionBackground": "#dbe7ff",
            "editor.lineHighlightBackground": "#151E2A",
            "editorCursor.foreground": "#2563eb",
            "editorWhitespace.foreground": "#384049",
        }
    }
    
    monaco_theme_file = default_theme_dir / 'monaco-theme.json'
    if not monaco_theme_file.exists():
        with open(monaco_theme_file, 'w') as f:
            json.dump(monaco_theme, f, indent=2)
        logger.info(f"Created Monaco theme at {monaco_theme_file}")
    
    return config_dir, config_file

def load_config():
    """Load configuration from file."""
    config_dir, config_file = ensure_config()
    with open(config_file, 'r') as f:
        config = json.load(f)
    return config

class WebSocketManager:
    def __init__(self):
        self.clients = set()
    
    async def connect(self, websocket: WebSocket):
        """Accept a WebSocket connection"""
        await websocket.accept()
        self.clients.add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.clients)}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        self.clients.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total clients: {len(self.clients)}")
    
    async def broadcast(self, message: str, sender: WebSocket = None):
        """Broadcast message to all connected clients"""
        for client in self.clients:
            try:
                await client.send_text(message)
            except Exception as e:
                logger.error(f"Error sending message: {e}")

manager = WebSocketManager()

# Global config directory
config_dir_global = None

# Create FastAPI app
# ─── File-system watcher ─────────────────────────────────────────────────────

_FS_EXCLUDE = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', '.mypy_cache', '.pytest_cache'}
_fs_timer: threading.Timer | None = None
_fs_timer_lock = threading.Lock()

def _schedule_fs_notification():
    global _fs_timer
    with _fs_timer_lock:
        if _fs_timer is not None:
            _fs_timer.cancel()
        def _notify():
            message_queue.append({"type": "fs-changed"})
        _fs_timer = threading.Timer(0.35, _notify)
        _fs_timer.daemon = True
        _fs_timer.start()

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler

    class _FSHandler(FileSystemEventHandler):
        def on_any_event(self, event):
            path_parts = set(Path(event.src_path).parts)
            if path_parts & _FS_EXCLUDE:
                return
            _schedule_fs_notification()

    _WATCHDOG_AVAILABLE = True
except ImportError:
    _WATCHDOG_AVAILABLE = False
    logger.warning("watchdog not installed — live file watching disabled")

@asynccontextmanager
async def lifespan(app: FastAPI):
    obs = None
    if _WATCHDOG_AVAILABLE:
        obs = Observer()
        obs.schedule(_FSHandler(), path=str(Path.cwd()), recursive=True)
        obs.start()
        logger.info(f"File watcher started on {Path.cwd()}")
    yield
    if obs:
        obs.stop()
        obs.join()

app = FastAPI(title="Koda", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}

@app.get("/api/config")
async def get_config():
    """Get current configuration"""
    config = load_config()
    return config

@app.get("/api/theme/{theme_name}/css")
async def get_theme_css(theme_name: str):
    """Get theme CSS file"""
    from fastapi.responses import FileResponse
    theme_file = config_dir_global / 'themes' / theme_name / 'theme.css'
    if theme_file.exists():
        return FileResponse(theme_file, media_type="text/css")
    return {"error": f"Theme '{theme_name}' not found"}, 404

@app.get("/api/theme/{theme_name}/monaco")
async def get_monaco_theme(theme_name: str):
    """Get Monaco theme JSON"""
    theme_file = config_dir_global / 'themes' / theme_name / 'monaco-theme.json'
    if theme_file.exists():
        with open(theme_file, 'r') as f:
            return json.load(f)
    return {"error": f"Theme '{theme_name}' not found"}, 404

# HTTP message queue for client communication
message_queue = []

@app.get("/api/messages")
async def get_messages():
    """Get pending messages"""
    global message_queue
    messages = message_queue
    message_queue = []
    return {"messages": messages}

@app.post("/api/messages")
async def post_message(body: dict = Body(...)):
    """Post a message"""
    global message_queue
    message_queue.append(body)
    logger.info(f"Message received: {body}")
    return {"status": "ok"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication"""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received message: {data}")
            await manager.broadcast(data)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)


@app.websocket("/ws/terminal/{terminal_id}")
async def terminal_websocket(websocket: WebSocket, terminal_id: str):
    """PTY terminal WebSocket — bridges xterm.js to a real shell process."""
    await websocket.accept()
    loop = asyncio.get_event_loop()

    try:
        from winpty import PtyProcess
        proc = PtyProcess.spawn(
            ['powershell.exe', '-NoLogo'],
            dimensions=(24, 80),
        )
    except Exception as e:
        await websocket.send_text(json.dumps({"type": "output", "data": f"[Failed to start shell: {e}]\r\n"}))
        await websocket.close()
        return

    output_queue: asyncio.Queue = asyncio.Queue()

    def pty_reader():
        while proc.isalive():
            try:
                data = proc.read(4096)
                if data:
                    loop.call_soon_threadsafe(output_queue.put_nowait, data)
            except EOFError:
                break
            except Exception:
                break
        loop.call_soon_threadsafe(output_queue.put_nowait, None)

    reader_thread = threading.Thread(target=pty_reader, daemon=True)
    reader_thread.start()

    async def send_output():
        while True:
            data = await output_queue.get()
            if data is None:
                break
            try:
                await websocket.send_text(json.dumps({"type": "output", "data": data}))
            except Exception:
                break

    send_task = asyncio.create_task(send_output())

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
                if msg.get("type") == "input":
                    proc.write(msg["data"])
                elif msg.get("type") == "resize":
                    proc.setwinsize(msg.get("rows", 24), msg.get("cols", 80))
            except json.JSONDecodeError:
                pass
    except Exception:
        pass
    finally:
        send_task.cancel()
        await output_queue.put(None)
        try:
            proc.terminate(force=True)
        except Exception:
            pass


@app.get("/api/fs/tree")
async def get_fs_tree(path: str = None, max_depth: int = 5):
    """Return a JSON representation of the file tree rooted at `path`.

    - If `path` is not provided, use the current working directory.
    - Respects a default `max_depth` to avoid huge responses.
    - Excludes `node_modules`, `.git`, and `__pycache__` directories.
    """
    EXCLUDE = {"node_modules", ".git", "__pycache__"}

    try:
        root = Path(path) if path else Path.cwd()
        root = root.resolve()
    except Exception:
        return {"error": "invalid path"}, 400

    def build_tree(p: Path, depth: int) -> Dict[str, Any]:
        node: Dict[str, Any] = {
            "name": p.name,
            "path": str(p),
            "type": "dir" if p.is_dir() else "file"
        }
        if p.is_dir():
            node_children: List[Dict[str, Any]] = []
            if depth <= 0:
                node["children"] = []
                return node

            try:
                for child in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                    if child.name in EXCLUDE:
                        continue
                    # skip symlink loops
                    try:
                        if child.is_dir():
                            node_children.append(build_tree(child, depth - 1))
                        else:
                            node_children.append({"name": child.name, "path": str(child), "type": "file"})
                    except Exception:
                        # ignore unreadable entries
                        continue
            except Exception:
                node_children = []

            node["children"] = node_children

        return node

    tree = build_tree(root, int(max_depth))
    return tree


@app.get("/api/fs/file")
async def get_fs_file(path: str):
    """Return the text contents of a file at `path`.

    - `path` must point to a readable file on disk.
    - Returns plain text (UTF-8) or an error object with an HTTP status.
    """
    from fastapi.responses import PlainTextResponse

    try:
        p = Path(path)
        # Resolve and guard a bit
        p = p.resolve()
        if not p.exists() or not p.is_file():
            return {"error": "file not found"}, 404

        # Read file as text
        with open(p, 'r', encoding='utf-8') as f:
            content = f.read()

        return PlainTextResponse(content, media_type='text/plain; charset=utf-8')
    except Exception as e:
        logger.exception(f"Failed to read file {path}: {e}")
        return {"error": str(e)}, 500

@app.put("/api/fs/file")
async def put_fs_file(request: Request):
    """Overwrite the text content of an existing file at `path`."""
    try:
        body = await request.json()
        path = body.get("path")
        content = body.get("content", "")
        if not path:
            return {"error": "path is required"}
        p = Path(path).resolve()
        if not p.exists() or not p.is_file():
            return {"error": "file not found"}
        with open(p, 'w', encoding='utf-8') as f:
            f.write(content)
        return {"success": True}
    except Exception as e:
        logger.exception(f"Failed to write file: {e}")
        return {"error": str(e)}


@app.delete("/api/fs/item")
async def delete_fs_item(path: str):
    """Delete a file or directory (directories are removed recursively)."""
    try:
        p = Path(path).resolve()
        if not p.exists():
            return {"error": "path does not exist"}, 404
        if p.is_dir():
            shutil.rmtree(p)
        else:
            p.unlink()
        return {"success": True}
    except Exception as e:
        logger.exception(f"Failed to delete {path}: {e}")
        return {"error": str(e)}, 500


@app.post("/api/fs/rename")
async def rename_fs_item(request: Request):
    """Rename a file or directory. Body: { path, new_name }."""
    try:
        body = await request.json()
        old_path = Path(body["path"]).resolve()
        new_name = body.get("new_name", "").strip()
        if not new_name:
            return {"error": "new_name is required"}, 400
        if "/" in new_name or "\\" in new_name:
            return {"error": "new_name must not contain path separators"}, 400
        if not old_path.exists():
            return {"error": "path does not exist"}, 404
        new_path = old_path.parent / new_name
        old_path.rename(new_path)
        return {"success": True, "new_path": str(new_path)}
    except Exception as e:
        logger.exception(f"Failed to rename: {e}")
        return {"error": str(e)}, 500


@app.post("/api/fs/copy")
async def copy_fs_item(request: Request):
    """Copy a file or directory into dest_dir. Body: { src, dest_dir }.
    Auto-generates a unique name if the destination already exists."""
    try:
        body = await request.json()
        src = Path(body["src"]).resolve()
        dest_dir = Path(body["dest_dir"]).resolve()
        if not src.exists():
            return {"error": "source does not exist"}, 404
        dest = dest_dir / src.name
        if dest.exists():
            stem = src.stem if src.is_file() else src.name
            suffix = src.suffix if src.is_file() else ""
            counter = 2
            while dest.exists():
                dest = dest_dir / f"{stem} copy {counter}{suffix}"
                counter += 1
        if src.is_dir():
            shutil.copytree(src, dest)
        else:
            shutil.copy2(src, dest)
        return {"success": True, "dest": str(dest)}
    except Exception as e:
        logger.exception(f"Failed to copy: {e}")
        return {"error": str(e)}, 500


@app.post("/api/fs/duplicate")
async def duplicate_fs_item(request: Request):
    """Duplicate a file or directory next to the original. Body: { path }."""
    try:
        body = await request.json()
        src = Path(body["path"]).resolve()
        if not src.exists():
            return {"error": "path does not exist"}, 404
        parent = src.parent
        if src.is_file():
            stem = src.stem
            suffix = src.suffix
            dest = parent / f"{stem} copy{suffix}"
            counter = 2
            while dest.exists():
                dest = parent / f"{stem} copy {counter}{suffix}"
                counter += 1
            shutil.copy2(src, dest)
        else:
            name = src.name
            dest = parent / f"{name} copy"
            counter = 2
            while dest.exists():
                dest = parent / f"{name} copy {counter}"
                counter += 1
            shutil.copytree(src, dest)
        return {"success": True, "dest": str(dest)}
    except Exception as e:
        logger.exception(f"Failed to duplicate: {e}")
        return {"error": str(e)}, 500


def run_server(config):
    """Run the FastAPI server"""
    uvicorn.run(
        app,
        host=config["server"]["host"],
        port=config["server"]["port"],
        log_level="info"
    )

if __name__ == "__main__":
    # Load configuration
    config = load_config()
    config_dir = get_config_dir()
    config_dir_global = config_dir
    logger.info(f"Config directory: {config_dir}")
    logger.info(f"Current theme: {config['theme']['current']}")
    
    # Start the FastAPI server in a background thread
    server_thread = threading.Thread(target=lambda: run_server(config), daemon=True)
    server_thread.start()
    
    server_host = config["server"]["host"]
    server_port = config["server"]["port"]
    logger.info(f"WebSocket server started on ws://{server_host}:{server_port}/ws")
    
    # Give the server a moment to start
    import time
    time.sleep(1)
    
    # Create webview window pointing to the frontend
    webview.create_window(
        title=config["app"]["title"],
        url=config["server"]["frontend_url"],
        background_color="#FFFFFF"
    )
    
    # Show the window
    webview.start()
