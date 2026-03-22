"""Harness Templates — 저장/로드/적용."""
import json
import time
from pathlib import Path
from claude_hub.utils.paths import ClaudePaths


TEMPLATES_DIR = Path.home() / ".claude-hub" / "templates"

BUILTIN_TEMPLATES = [
    {
        "name": "react-typescript",
        "display_name": "React + TypeScript Starter",
        "description": "React 19 + TypeScript 프론트엔드 프로젝트를 위한 harness. TDD, 컴포넌트 설계 중심.",
        "builtin": True,
        "claude_md": "# React + TypeScript Project\n\n## 코드 규칙\n- 함수형 컴포넌트 + hooks 사용\n- TypeScript strict 모드\n- Tailwind CSS 유틸리티 우선\n\n## 테스트\n- Vitest + React Testing Library\n- 컴포넌트 단위 테스트 필수\n\n## 구조\n- src/components/ — UI 컴포넌트\n- src/hooks/ — 커스텀 훅\n- src/lib/ — 유틸리티",
        "hooks": [{"event": "PostToolUse", "command": "npm test -- --run", "reason": "변경 후 자동 테스트"}],
        "mcp_servers": {},
        "tags": ["frontend", "react", "typescript"],
    },
    {
        "name": "python-fastapi",
        "display_name": "Python FastAPI Backend",
        "description": "FastAPI + Pydantic v2 백엔드. pytest 자동실행, systematic-debugging 활용.",
        "builtin": True,
        "claude_md": "# FastAPI Backend\n\n## 코드 규칙\n- Pydantic v2 모델, dataclass 지양\n- async/await 패턴\n- 타입 힌트 필수\n\n## 테스트\n- pytest + httpx AsyncClient\n- 각 라우터별 테스트 파일\n\n## 구조\n- src/app/ — FastAPI 앱\n- src/app/routers/ — API 라우터\n- src/app/services/ — 비즈니스 로직\n- src/app/models/ — Pydantic 모델",
        "hooks": [{"event": "PostToolUse", "command": "pytest tests/ -q", "reason": "변경 후 자동 테스트"}],
        "mcp_servers": {},
        "tags": ["backend", "python", "fastapi"],
    },
    {
        "name": "fullstack-monorepo",
        "display_name": "Fullstack Monorepo",
        "description": "프론트엔드 + 백엔드 통합 프로젝트. 빌드 파이프라인 포함.",
        "builtin": True,
        "claude_md": "# Fullstack Monorepo\n\n## 구조\n- frontend/ — React SPA\n- backend/ — API 서버\n- shared/ — 공통 타입/유틸\n\n## 규칙\n- 프론트/백 동시 변경 시 양쪽 테스트 실행\n- API 변경 시 shared 타입 동기화",
        "hooks": [],
        "mcp_servers": {},
        "tags": ["fullstack", "monorepo"],
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
    """이름으로 템플릿 조회. 내장 → 사용자 순서로 탐색."""
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
    """사용자 템플릿 저장 후 이름 반환."""
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
    name = data.get("name") or f"template-{int(time.time())}"
    data["created_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    path = TEMPLATES_DIR / f"{name}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return name


def delete_template(name: str) -> bool:
    """사용자 템플릿 삭제. 내장 템플릿은 삭제 불가."""
    path = TEMPLATES_DIR / f"{name}.json"
    if path.exists():
        path.unlink()
        return True
    return False


def export_current(project_path: str, paths: ClaudePaths) -> dict:
    """현재 프로젝트 설정을 템플릿 구조로 변환."""
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

    return result


def apply_template(name: str, project_path: str, paths: ClaudePaths) -> dict:
    """템플릿을 프로젝트에 적용. CLAUDE.md 작성 + hooks 추가."""
    import json as _json

    tmpl = get_template(name)
    if tmpl is None:
        raise ValueError(f"Template '{name}' not found")

    project_dir = Path(project_path).expanduser().resolve()
    applied = []

    # CLAUDE.md 적용
    if tmpl.get("claude_md"):
        (project_dir / "CLAUDE.md").write_text(tmpl["claude_md"], encoding="utf-8")
        applied.append("claude_md")

    # Hooks 적용
    if tmpl.get("hooks") and paths.settings_path.exists():
        settings = _json.loads(paths.settings_path.read_text())
        mtime = paths.settings_path.stat().st_mtime
        hooks_cfg = settings.setdefault("hooks", {})
        for hook in tmpl["hooks"]:
            event = hook.get("event", "")
            command = hook.get("command", "")
            if event and command:
                hooks_cfg.setdefault(event, []).append(
                    {"hooks": [{"type": "command", "command": command}]}
                )
        paths.settings_path.write_text(_json.dumps(settings, indent=2, ensure_ascii=False))
        applied.append("hooks")

    return {"applied": applied, "project_path": str(project_dir)}
