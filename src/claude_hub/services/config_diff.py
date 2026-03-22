"""프로젝트 간 Claude 설정 비교."""
import json
from pathlib import Path
from claude_hub.utils.paths import ClaudePaths
from claude_hub.utils.diff import unified_diff


def diff_projects(project_a: str, project_b: str, paths: ClaudePaths) -> list[dict]:
    """두 프로젝트의 Claude 설정을 비교하여 결과 목록 반환."""
    results = []
    projects_dir = paths.projects_dir

    encoded_a = project_a.replace("/", "-")
    encoded_b = project_b.replace("/", "-")
    dir_a = projects_dir / encoded_a
    dir_b = projects_dir / encoded_b

    # CLAUDE.md 비교 (프로젝트 루트에 있는 파일)
    claude_a = Path(project_a).expanduser() / "CLAUDE.md" if "/" in project_a else dir_a / "CLAUDE.md"
    claude_b = Path(project_b).expanduser() / "CLAUDE.md" if "/" in project_b else dir_b / "CLAUDE.md"
    results.append(_compare_files("CLAUDE.md", claude_a, claude_b))

    # Memory 파일 목록 비교
    mem_a = dir_a / "memory"
    mem_b = dir_b / "memory"
    files_a = sorted(f.name for f in mem_a.iterdir()) if mem_a.exists() else []
    files_b = sorted(f.name for f in mem_b.iterdir()) if mem_b.exists() else []

    if not files_a and not files_b:
        mem_status = "both_missing"
    elif files_a == files_b:
        mem_status = "identical"
    elif not files_b:
        mem_status = "missing"
    else:
        mem_status = "different"

    results.append({
        "component": "Memory",
        "a_value": f"{len(files_a)} files",
        "b_value": f"{len(files_b)} files",
        "status": mem_status,
        "diff": None,
    })

    # 전역 설정은 공유이므로 동일하게 표시
    if paths.settings_path.exists():
        settings = json.loads(paths.settings_path.read_text())

        model = settings.get("model", "unknown")
        results.append({
            "component": "Settings",
            "a_value": f"model: {model}",
            "b_value": f"model: {model}",
            "status": "identical",
            "diff": None,
        })

        hooks = settings.get("hooks", {})
        hook_count = sum(len(g) for g in hooks.values())
        results.append({
            "component": "Hooks",
            "a_value": f"{hook_count}개",
            "b_value": f"{hook_count}개",
            "status": "identical",
            "diff": None,
        })

        mcp = settings.get("mcpServers", {})
        mcp_names = ", ".join(mcp.keys()) if mcp else "없음"
        results.append({
            "component": "MCP Servers",
            "a_value": mcp_names,
            "b_value": mcp_names,
            "status": "identical",
            "diff": None,
        })

    return results


def sync_claude_md(source_path: str, target_path: str) -> dict:
    """source 프로젝트의 CLAUDE.md를 target 프로젝트로 복사."""
    src = Path(source_path).expanduser() / "CLAUDE.md"
    dst = Path(target_path).expanduser() / "CLAUDE.md"

    if not src.exists():
        raise ValueError(f"CLAUDE.md not found in source: {source_path}")

    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(src.read_text(errors="ignore"), encoding="utf-8")
    return {"synced": True, "target": str(dst)}


def _compare_files(name: str, path_a: Path, path_b: Path) -> dict:
    """두 파일 경로를 비교하여 diff 결과 반환."""
    a_exists = path_a.exists()
    b_exists = path_b.exists()
    a_content = path_a.read_text(errors="ignore") if a_exists else ""
    b_content = path_b.read_text(errors="ignore") if b_exists else ""

    if not a_exists and not b_exists:
        status = "both_missing"
    elif not b_exists:
        status = "missing"
    elif a_content == b_content:
        status = "identical"
    else:
        status = "different"

    diff = unified_diff(a_content, b_content, name) if status == "different" else None

    return {
        "component": name,
        "a_value": f"{len(a_content.splitlines())}줄" if a_exists else "없음",
        "b_value": f"{len(b_content.splitlines())}줄" if b_exists else "없음",
        "status": status,
        "diff": diff,
    }
