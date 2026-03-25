<p align="center">
  <img src="scripts/macos/icon.svg" width="80" height="80" alt="claude-hub icon" />
</p>

<h1 align="center">claude-hub</h1>

<p align="center">
  <strong>Visual dashboard for managing your entire Claude Code configuration.</strong><br />
  Skills, Plugins, MCP Servers, Memory, CLAUDE.md — all in one place.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.13+-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/react-19-61dafb?style=flat-square" />
  <img src="https://img.shields.io/badge/fastapi-latest-009688?style=flat-square" />
  <img src="https://img.shields.io/badge/license-MIT-yellow?style=flat-square" />
</p>

---

## What is claude-hub?

**claude-hub** is a local web dashboard that gives you full visual control over your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) environment. Instead of manually editing JSON files and Markdown scattered across `~/.claude/`, you get a single UI to manage everything.

### The Problem

Claude Code stores its configuration across dozens of files:

```
~/.claude/
  ├── settings.json          # Global settings, model, permissions
  ├── settings.local.json    # Local overrides
  ├── CLAUDE.md              # Global instructions
  ├── keybindings.json       # Keyboard shortcuts
  ├── skills/                # 30+ skill directories
  ├── plugins/               # Plugin packages
  ├── agents/                # Agent definitions
  ├── projects/              # Per-project sessions, memory, config
  │   ├── -Users-.../
  │   │   ├── memory/        # Project memory files
  │   │   └── *.jsonl        # Session histories
  └── ...
```

Managing this by hand is tedious, error-prone, and you never have a clear picture of what's configured where.

### The Solution

claude-hub reads and writes these files through a visual interface — with backup, diff preview, and conflict detection built in.

---

## Features

### Dashboard
- Real-time rate limit monitoring (Session / Weekly / Model — via Anthropic OAuth API)
- Token usage & estimated cost tracking (Today / Weekly / Monthly)
- Top used skills & plugins chart
- Auto-refresh with configurable interval (1m / 3m / 5m / 10m)

### Extensions Management
- **Skills**: Browse, create, edit, delete. Duplicate skill detection with side-by-side comparison and similarity scoring
- **Plugins**: Toggle, install from marketplace, remove
- **Agents**: View and edit agent definitions
- **Hooks**: Visual hook editor for all 11 event types
- **MCP Servers**: Configure, install from marketplace, manage environment variables (masked)

### Context Management
- **CLAUDE.md**: Edit global and per-project instruction files with Monaco Editor
- **Memory**: Browse and edit per-project memory files
- **Context Compare**: Diff two projects' configurations side by side, sync with one click

### Session History
- Browse all Claude Code conversation histories by project
- Chat-style message viewer with inline tool call display
- Session delete

### Project Status
- Left-right split layout: project list + file tree
- Main repository and worktree separation with visual distinction
- Favorites pinning (localStorage-based)
- Project removal (delete `~/.claude/projects/{project}`)

### Marketplace
- Browse official & community plugins
- Browse and install MCP servers (auto-configures `settings.json`)
- Installed filter with uninstall support

### Cost Tracking
- Per-project cost breakdown
- Model-specific usage (Opus / Sonnet / Haiku)
- 7-day / 30-day / all-time periods

### Additional
- Templates: Export/import harness configurations across projects
- Keybindings: Visual keyboard shortcut editor
- Hub Settings: macOS auto-launch on login (LaunchAgent)
- Backup History: Automatic backup before every config change, one-click restore

---

## Quick Start

### Prerequisites

- **Python 3.13+**
- **Node.js 18+** (for frontend build)
- **[uv](https://docs.astral.sh/uv/)** (Python package manager)
- **Claude Code** installed and authenticated (`claude auth login`)

### Install & Run

```bash
# Clone
git clone https://github.com/amebahead/claude-hub.git
cd claude-hub

# Build frontend
bash scripts/build.sh

# Run
uv run claude-hub
```

Opens at **http://localhost:3847**

### macOS App (optional)

```bash
# Create .app bundle in /Applications
bash scripts/macos/create-app.sh

# Launch from Spotlight or Finder
# Menu bar tray icon stays active after closing window
```

### Auto-launch on Login

Enabled by default on first run. Toggle in **Labs > Hub Settings**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.13 / FastAPI / Pydantic v2 / uvicorn |
| Frontend | Vite + React 19 + Tailwind CSS v4 + Monaco Editor |
| Database | SQLite (usage statistics) |
| Packaging | PyPI (uv build) |
| macOS App | AppleScript bundle + LaunchAgent |
| Tests | pytest |

---

## Architecture

```
claude-hub
├── src/
│   ├── claude_hub/              # Python backend
│   │   ├── main.py              # FastAPI app + CLI entry
│   │   ├── routers/             # API endpoints (22 routers)
│   │   ├── services/            # Business logic
│   │   └── utils/               # Path encoding, CLI wrapper
│   └── client/                  # React frontend
│       ├── src/
│       │   ├── pages/           # 24 page components
│       │   ├── components/      # Shared UI components
│       │   └── lib/             # API client, i18n, types
│       └── dist/                # Built static files
├── tests/
├── scripts/
│   ├── build.sh                 # Frontend build
│   └── macos/                   # .app creation + icon
└── pyproject.toml
```

### Design Principles

- **Local-only**: Binds to `127.0.0.1` — your config never leaves your machine
- **Non-destructive**: Automatic backup before every write operation
- **Conflict-safe**: mtime-based optimistic locking (409 on concurrent edits)
- **Zero config**: Reads `~/.claude/` filesystem directly, no setup required
- **Env var masking**: MCP server secrets are masked at API level

---

## API

All endpoints are under `/api/`. Key routes:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | Overview stats |
| GET/PUT | `/skills`, `/plugins`, `/agents` | CRUD operations |
| GET/PUT | `/mcp` | MCP server configuration |
| GET/PUT | `/settings` | Global/local settings |
| GET | `/claude/rate-limits` | Live rate limits (OAuth) |
| GET | `/claude/usage` | Token usage summary |
| GET | `/sessions` | Session history |
| GET | `/skills/duplicates/scan` | Duplicate skill detection |
| POST | `/marketplace/mcp/install` | Install MCP server |
| DELETE | `/projects/{encoded}` | Remove project config |

---

## Development

```bash
# Backend (auto-reload)
uv run uvicorn claude_hub.main:create_app --factory --reload --port 3847

# Frontend (dev server with HMR)
cd src/client && npm run dev

# Tests
uv run pytest tests/ -v

# Build
bash scripts/build.sh
```

---

## Roadmap

- [ ] Screenshot gallery
- [ ] PyPI publish (`pip install claude-hub`)
- [ ] Plugin/skill usage analytics dashboard
- [ ] Multi-language support (EN/KO currently)
- [ ] Session search & filtering
- [ ] Export config as shareable template
- [ ] Linux support (LaunchAgent → systemd)

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with Claude Code, for Claude Code users.
</p>
