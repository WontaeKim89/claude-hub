# claude-hub

Visual dashboard for managing your Claude Code configuration.

Manage skills, plugins, agents, hooks, MCP servers, settings, and more — all from a local web UI.

## Features

- **Dashboard** — Overview of all Claude Code configuration at a glance
- **Skills Management** — Create, edit, and organize custom skills
- **Plugin Management** — Enable/disable plugins, browse marketplace
- **Agent & Command Editor** — CRUD with Monaco editor
- **Settings** — Visual form editor for settings.json
- **Hooks Manager** — Configure event hooks with 11 event types
- **MCP Servers** — Manage Model Context Protocol servers (env vars masked)
- **CLAUDE.md Editor** — Edit global and project-level instructions
- **Memory Manager** — Browse and edit project memory files
- **Marketplace** — Browse and install plugins from registries
- **Safety** — Automatic backups, validation, conflict detection, preview diff

## Quick Start

```bash
# Run without installing (requires uv)
uvx claude-hub

# Or install globally
uv tool install claude-hub
claude-hub
```

Opens `http://localhost:3847` in your browser.

## Options

```bash
claude-hub --port 4000          # Custom port
claude-hub --no-open            # Don't auto-open browser
claude-hub --claude-dir /path   # Custom .claude directory
```

## Development

```bash
git clone https://github.com/claude-hub/claude-hub
cd claude-hub

# Backend
uv sync
uv run uvicorn claude_hub.main:app --reload --port 3847

# Frontend (separate terminal)
cd src/client
npm install
npm run dev

# Tests
uv run pytest tests/ -v

# Build
bash scripts/build.sh
```

## Tech Stack

- **Backend:** Python 3.13+ / FastAPI / Pydantic v2
- **Frontend:** React 19 / Vite / Tailwind CSS / Monaco Editor
- **Package:** PyPI (uv)

## Safety

- All file modifications are backed up automatically
- Conflict detection prevents overwriting external changes
- Preview diff before saving
- JSON/YAML validation before write
- Sensitive env vars masked in API responses
- Binds to 127.0.0.1 by default (localhost only)

## License

MIT
