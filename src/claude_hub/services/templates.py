"""Harness Templates — 저장/로드/적용/커뮤니티 fetch."""
import json
import time
from pathlib import Path
from claude_hub.utils.paths import ClaudePaths


TEMPLATES_DIR = Path.home() / ".claude-hub" / "templates"

# 확장된 내장 템플릿 (풀 하네스 세트)
BUILTIN_TEMPLATES = [
    {
        "name": "react-typescript",
        "display_name": "React + TypeScript Starter",
        "description": "React 19 + TypeScript frontend with TDD, component-driven design.",
        "builtin": True,
        "claude_md": "# React + TypeScript Project\n\n## Code Rules\n- Functional components + hooks\n- TypeScript strict mode\n- Tailwind CSS utility-first\n\n## Testing\n- Vitest + React Testing Library\n- Component unit tests required\n\n## Structure\n- src/components/ — UI components\n- src/hooks/ — Custom hooks\n- src/lib/ — Utilities",
        "hooks": [{"event": "PostToolUse", "command": "npm test -- --run", "reason": "Auto-test after changes"}],
        "mcp_servers": {},
        "memory_files": {"MEMORY.md": "# Project Memory\n\n## Key Decisions\n\n## Patterns\n"},
        "skills": [],
        "tags": ["frontend", "react", "typescript"],
    },
    {
        "name": "python-fastapi",
        "display_name": "Python FastAPI Backend",
        "description": "FastAPI + Pydantic v2 backend with pytest, async patterns.",
        "builtin": True,
        "claude_md": "# FastAPI Backend\n\n## Code Rules\n- Pydantic v2 models, avoid dataclass\n- async/await patterns\n- Type hints required\n\n## Testing\n- pytest + httpx AsyncClient\n- Test file per router\n\n## Structure\n- src/app/ — FastAPI app\n- src/app/routers/ — API routers\n- src/app/services/ — Business logic\n- src/app/models/ — Pydantic models",
        "hooks": [{"event": "PostToolUse", "command": "pytest tests/ -q", "reason": "Auto-test after changes"}],
        "mcp_servers": {},
        "memory_files": {"MEMORY.md": "# Project Memory\n\n## Architecture\n\n## Error Fixes\n"},
        "skills": [],
        "tags": ["backend", "python", "fastapi"],
    },
    {
        "name": "fullstack-monorepo",
        "display_name": "Fullstack Monorepo",
        "description": "Frontend + backend integrated project with shared types.",
        "builtin": True,
        "claude_md": "# Fullstack Monorepo\n\n## Structure\n- frontend/ — React SPA\n- backend/ — API server\n- shared/ — Common types/utils\n\n## Rules\n- Run both tests on cross-boundary changes\n- Sync shared types on API changes",
        "hooks": [],
        "mcp_servers": {},
        "memory_files": {},
        "skills": [],
        "tags": ["fullstack", "monorepo"],
    },
    {
        "name": "nextjs-app",
        "display_name": "Next.js App Router",
        "description": "Next.js 15 with App Router, Server Components, and Tailwind CSS.",
        "builtin": True,
        "claude_md": "# Next.js App Router Project\n\n## Rules\n- App Router (not Pages Router)\n- Server Components by default, 'use client' only when needed\n- Server Actions for mutations\n- Tailwind CSS for styling\n\n## Structure\n- app/ — Routes and layouts\n- components/ — Shared UI\n- lib/ — Data fetching, utils\n\n## Testing\n- Jest + React Testing Library\n- E2E with Playwright",
        "hooks": [{"event": "PostToolUse", "command": "npm run lint", "reason": "Lint after changes"}],
        "mcp_servers": {},
        "memory_files": {},
        "skills": [],
        "tags": ["frontend", "nextjs", "react", "typescript"],
    },
    {
        "name": "python-data-science",
        "display_name": "Python Data Science",
        "description": "Data science project with pandas, notebooks, and visualization.",
        "builtin": True,
        "claude_md": "# Data Science Project\n\n## Rules\n- Use pandas for data manipulation\n- Matplotlib/Seaborn for visualization\n- Jupyter notebooks for exploration, .py for production\n- Document data assumptions\n\n## Structure\n- notebooks/ — Exploration\n- src/ — Production code\n- data/ — Raw and processed data\n- models/ — Trained models",
        "hooks": [],
        "mcp_servers": {},
        "memory_files": {"MEMORY.md": "# Data Science Memory\n\n## Datasets\n\n## Model Experiments\n"},
        "skills": [],
        "tags": ["python", "data-science", "ml"],
    },
    {
        "name": "go-microservice",
        "display_name": "Go Microservice",
        "description": "Go microservice with clean architecture and gRPC/REST.",
        "builtin": True,
        "claude_md": "# Go Microservice\n\n## Rules\n- Clean Architecture (handler → service → repository)\n- Interface-driven design\n- Table-driven tests\n- Error wrapping with context\n\n## Structure\n- cmd/ — Entry points\n- internal/ — Private packages\n- pkg/ — Public packages\n- api/ — Proto/OpenAPI definitions",
        "hooks": [{"event": "PostToolUse", "command": "go test ./...", "reason": "Auto-test"}],
        "mcp_servers": {},
        "memory_files": {},
        "skills": [],
        "tags": ["backend", "go", "microservice"],
    },
    {
        "name": "rust-cli",
        "display_name": "Rust CLI Tool",
        "description": "Rust CLI application with clap, error handling, and testing.",
        "builtin": True,
        "claude_md": "# Rust CLI\n\n## Rules\n- clap for argument parsing\n- thiserror for error types\n- anyhow for error propagation\n- Integration tests in tests/\n\n## Structure\n- src/main.rs — Entry point\n- src/lib.rs — Core logic\n- src/cli.rs — CLI argument definitions",
        "hooks": [{"event": "PostToolUse", "command": "cargo test", "reason": "Auto-test"}],
        "mcp_servers": {},
        "memory_files": {},
        "skills": [],
        "tags": ["rust", "cli"],
    },
    {
        "name": "azure-infra",
        "display_name": "Azure Infrastructure",
        "description": "Azure cloud infrastructure with Terraform/Bicep and CI/CD.",
        "builtin": True,
        "claude_md": "# Azure Infrastructure\n\n## Rules\n- Terraform for IaC (prefer over Bicep)\n- Module-based architecture\n- Remote state in Azure Storage\n- Tag all resources\n\n## Structure\n- infra/ — Terraform modules\n- pipelines/ — CI/CD definitions\n- docs/ — Architecture diagrams\n\n## Security\n- No secrets in code\n- Use Azure Key Vault\n- Managed Identity preferred",
        "hooks": [],
        "mcp_servers": {},
        "memory_files": {"MEMORY.md": "# Azure Infra Memory\n\n## Resource Groups\n\n## Deployment History\n"},
        "skills": [],
        "tags": ["devops", "azure", "terraform", "infrastructure"],
    },
    {
        "name": "langchain-agent",
        "display_name": "LangChain/LangGraph Agent",
        "description": "AI agent with LangChain/LangGraph, tool use, and memory.",
        "builtin": True,
        "claude_md": "# LangChain Agent Project\n\n## Rules\n- LangGraph for agent orchestration\n- Structured tool definitions\n- Async by default\n- Pydantic for I/O schemas\n\n## Structure\n- src/agents/ — Agent definitions\n- src/tools/ — Custom tools\n- src/prompts/ — Prompt templates\n- src/memory/ — Memory backends\n\n## Testing\n- Mock LLM calls in tests\n- Integration tests with real API (optional)",
        "hooks": [{"event": "PostToolUse", "command": "pytest tests/ -q", "reason": "Auto-test"}],
        "mcp_servers": {},
        "memory_files": {"MEMORY.md": "# Agent Memory\n\n## Architecture Decisions\n\n## Prompt Engineering Notes\n"},
        "skills": [],
        "tags": ["python", "ai", "langchain", "agent"],
    },
    {
        "name": "mobile-react-native",
        "display_name": "React Native Mobile",
        "description": "React Native + Expo mobile app with TypeScript.",
        "builtin": True,
        "claude_md": "# React Native Mobile App\n\n## Rules\n- Expo managed workflow\n- TypeScript strict\n- React Navigation for routing\n- Zustand for state management\n\n## Structure\n- app/ — Screens (Expo Router)\n- components/ — Shared UI\n- hooks/ — Custom hooks\n- lib/ — API client, utils\n\n## Testing\n- Jest + React Native Testing Library",
        "hooks": [],
        "mcp_servers": {},
        "memory_files": {},
        "skills": [],
        "tags": ["mobile", "react-native", "expo", "typescript"],
    },
    {
        "name": "devops-cicd",
        "display_name": "DevOps CI/CD Pipeline",
        "description": "CI/CD setup with GitHub Actions, Docker, and deployment.",
        "builtin": True,
        "claude_md": "# DevOps CI/CD\n\n## Rules\n- GitHub Actions for CI/CD\n- Multi-stage Docker builds\n- Environment-specific configs\n- Semantic versioning\n\n## Structure\n- .github/workflows/ — CI/CD pipelines\n- docker/ — Dockerfiles\n- k8s/ — Kubernetes manifests\n- scripts/ — Deployment scripts\n\n## Security\n- Secrets in GitHub Secrets\n- Image scanning with Trivy",
        "hooks": [],
        "mcp_servers": {"github": {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"]}},
        "memory_files": {},
        "skills": [],
        "tags": ["devops", "cicd", "docker", "github-actions"],
    },
    {
        "name": "documentation",
        "display_name": "Documentation Project",
        "description": "Technical documentation with clear structure and style guide.",
        "builtin": True,
        "claude_md": "# Documentation Project\n\n## Writing Rules\n- Clear, concise language\n- Code examples for every concept\n- Consistent terminology\n- Progressive disclosure (basic → advanced)\n\n## Structure\n- docs/ — Main documentation\n- docs/guides/ — How-to guides\n- docs/reference/ — API reference\n- docs/tutorials/ — Step-by-step tutorials",
        "hooks": [],
        "mcp_servers": {},
        "memory_files": {"MEMORY.md": "# Docs Memory\n\n## Style Guide\n\n## Terminology\n"},
        "skills": [],
        "tags": ["documentation", "writing"],
    },
]

# GitHub 커뮤니티 레지스트리
COMMUNITY_SOURCES = [
    {
        "name": "awesome-claude-code-toolkit",
        "url": "https://raw.githubusercontent.com/rohitg00/awesome-claude-code-toolkit/main/templates/index.json",
        "description": "Curated Claude Code templates from the community",
    },
    {
        "name": "claude-md-templates",
        "url": "https://raw.githubusercontent.com/abhishekray07/claude-md-templates/main/templates.json",
        "description": "CLAUDE.md best practices collection",
    },
]


def list_templates() -> list[dict]:
    """내장 + 사용자 템플릿 목록 반환."""
    result = list(BUILTIN_TEMPLATES)
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
    for f in sorted(TEMPLATES_DIR.glob("*.json")):
        try:
            data = json.loads(f.read_text())
            data["builtin"] = False
            result.append(data)
        except Exception:
            continue
    return result


def get_template(name: str) -> dict | None:
    for t in BUILTIN_TEMPLATES:
        if t["name"] == name:
            return t
    path = TEMPLATES_DIR / f"{name}.json"
    if path.exists():
        data = json.loads(path.read_text())
        data["builtin"] = False
        return data
    return None


def save_template(data: dict) -> str:
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
    name = data.get("name") or f"template-{int(time.time())}"
    data["created_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    path = TEMPLATES_DIR / f"{name}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return name


def delete_template(name: str) -> bool:
    path = TEMPLATES_DIR / f"{name}.json"
    if path.exists():
        path.unlink()
        return True
    return False


def export_current(project_path: str, paths: ClaudePaths) -> dict:
    """현재 프로젝트 설정을 풀 하네스 템플릿으로 변환."""
    from claude_hub.utils.paths import encode_project_path

    project_dir = Path(project_path).expanduser().resolve()
    result: dict = {
        "name": "",
        "display_name": project_dir.name,
        "description": "",
        "builtin": False,
    }

    claude_md = project_dir / "CLAUDE.md"
    result["claude_md"] = claude_md.read_text(errors="ignore") if claude_md.exists() else ""

    if paths.settings_path.exists():
        settings = json.loads(paths.settings_path.read_text())
        hooks: list[dict] = []
        for event, groups in settings.get("hooks", {}).items():
            for group in groups:
                for hook in group.get("hooks", []):
                    hooks.append({"event": event, "command": hook.get("command", "")})
        result["hooks"] = hooks
        result["mcp_servers"] = settings.get("mcpServers", {})
    else:
        result["hooks"] = []
        result["mcp_servers"] = {}

    # 메모리 파일 포함
    encoded = encode_project_path(str(project_dir))
    memory_dir = paths.projects_dir / encoded / "memory"
    memory_files = {}
    if memory_dir.exists():
        for f in sorted(memory_dir.iterdir()):
            if f.is_file() and f.suffix == ".md":
                memory_files[f.name] = f.read_text(errors="ignore")
    result["memory_files"] = memory_files

    return result


def apply_template(name: str, project_path: str, paths: ClaudePaths) -> dict:
    """풀 하네스 템플릿을 프로젝트에 적용."""
    from claude_hub.utils.paths import encode_project_path

    tmpl = get_template(name)
    if tmpl is None:
        raise ValueError(f"Template '{name}' not found")

    project_dir = Path(project_path).expanduser().resolve()
    applied = []

    # CLAUDE.md
    if tmpl.get("claude_md"):
        (project_dir / "CLAUDE.md").write_text(tmpl["claude_md"], encoding="utf-8")
        applied.append("claude_md")

    # Hooks
    if tmpl.get("hooks") and paths.settings_path.exists():
        settings = json.loads(paths.settings_path.read_text())
        hooks_cfg = settings.setdefault("hooks", {})
        for hook in tmpl["hooks"]:
            event = hook.get("event", "")
            command = hook.get("command", "")
            if event and command:
                hooks_cfg.setdefault(event, []).append(
                    {"hooks": [{"type": "command", "command": command}]}
                )
        paths.settings_path.write_text(json.dumps(settings, indent=2, ensure_ascii=False))
        applied.append("hooks")

    # MCP Servers
    if tmpl.get("mcp_servers") and paths.settings_path.exists():
        settings = json.loads(paths.settings_path.read_text())
        mcp = settings.setdefault("mcpServers", {})
        for name_key, cfg in tmpl["mcp_servers"].items():
            if name_key not in mcp:
                mcp[name_key] = cfg
        paths.settings_path.write_text(json.dumps(settings, indent=2, ensure_ascii=False))
        applied.append("mcp_servers")

    # Memory Files
    if tmpl.get("memory_files"):
        encoded = encode_project_path(str(project_dir))
        memory_dir = paths.projects_dir / encoded / "memory"
        memory_dir.mkdir(parents=True, exist_ok=True)
        for fname, content in tmpl["memory_files"].items():
            (memory_dir / fname).write_text(content, encoding="utf-8")
        applied.append("memory_files")

    return {"applied": applied, "project_path": str(project_dir)}


async def fetch_community_templates() -> list[dict]:
    """GitHub에서 커뮤니티 템플릿을 fetch."""
    import httpx

    results = []
    async with httpx.AsyncClient(timeout=10) as client:
        for source in COMMUNITY_SOURCES:
            try:
                resp = await client.get(source["url"])
                if resp.status_code == 200:
                    data = resp.json()
                    templates = data if isinstance(data, list) else data.get("templates", [])
                    for t in templates:
                        t["source"] = source["name"]
                        t["builtin"] = False
                        results.append(t)
            except Exception:
                continue
    return results
