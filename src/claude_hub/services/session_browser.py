"""세션 브라우저 — 프로젝트별 세션 목록 및 대화 내역 조회."""
import json
from pathlib import Path

from claude_hub.utils.paths import ClaudePaths, decode_project_path


def list_sessions(paths: ClaudePaths, project_encoded: str | None = None) -> list[dict]:
    """프로젝트별 세션 목록. project_encoded가 None이면 전체."""
    sessions = []
    projects_dir = paths.projects_dir
    if not projects_dir.exists():
        return sessions

    dirs = [projects_dir / project_encoded] if project_encoded else sorted(projects_dir.iterdir())

    # 제외할 디렉토리: subagents, 단일 세그먼트 루트 경로
    EXCLUDE = {"subagents"}

    for project_dir in dirs:
        if not project_dir.is_dir():
            continue
        project_name = project_dir.name
        if project_name in EXCLUDE:
            continue
        # 경로 세그먼트가 너무 적은 디렉토리 제외 (/, /Users/xxx, /Desktop 등)
        segments = project_name.lstrip("-").split("-")
        if len(segments) <= 2 and not any(project_dir.glob("*.jsonl")):
            continue
        for jsonl in sorted(project_dir.glob("*.jsonl"), key=lambda f: f.stat().st_mtime, reverse=True):
            stat = jsonl.stat()
            try:
                with open(jsonl, "r", errors="ignore") as f:
                    line_count = sum(1 for _ in f)
            except Exception:
                line_count = 0

            title = _extract_session_title(jsonl)

            sessions.append({
                "id": jsonl.stem,
                "project": project_name,
                "project_path": decode_project_path(project_name),
                "file": str(jsonl),
                "size": stat.st_size,
                "modified": stat.st_mtime,
                "message_count": line_count,
                "title": title,
            })

    return sessions


def get_session_messages(session_path: str, limit: int = 200) -> list[dict]:
    """세션의 대화 메시지를 파싱하여 반환."""
    path = Path(session_path)
    if not path.exists():
        return []

    messages = []
    with open(path, "r", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                msg = entry.get("message", entry)
                role = msg.get("role", "")
                if role not in ("user", "assistant"):
                    continue

                content = msg.get("content", "")
                parsed = _parse_content(content)
                if parsed:
                    messages.append({
                        "role": role,
                        "content": parsed,
                        "model": msg.get("model", ""),
                    })
            except (json.JSONDecodeError, TypeError):
                continue

    return messages[-limit:]


def delete_session(session_path: str) -> bool:
    """세션 JSONL 파일 삭제."""
    path = Path(session_path)
    if path.exists() and path.suffix == ".jsonl":
        path.unlink()
        return True
    return False


def _clean_title(text: str) -> str:
    """시스템 태그, XML 태그, 빈 줄 등을 제거하여 의미있는 제목만 추출."""
    import re
    # XML/HTML 태그 제거
    cleaned = re.sub(r"<[^>]+>", "", text).strip()
    # 여러 줄이면 첫 의미있는 줄
    for line in cleaned.splitlines():
        line = line.strip()
        if line and len(line) > 3:
            return line[:100]
    return cleaned[:100] if cleaned else ""


def _is_meaningful_text(text: str) -> bool:
    """시스템 메시지가 아닌 실제 사용자 입력인지 판별."""
    if not text or len(text.strip()) < 3:
        return False
    # 시스템 태그로 시작하는 경우 스킵
    stripped = text.strip()
    if stripped.startswith("<") and ">" in stripped[:60]:
        return False
    return True


def _extract_session_title(path: Path) -> str:
    """세션에서 의미있는 첫 사용자 메시지를 제목으로 추출."""
    try:
        with open(path, "r", errors="ignore") as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                    msg = entry.get("message", entry)
                    if msg.get("role") != "user":
                        continue

                    content = msg.get("content", "")
                    text = ""

                    if isinstance(content, str):
                        text = content
                    elif isinstance(content, list):
                        for block in content:
                            if isinstance(block, dict) and block.get("type") == "text":
                                text = block.get("text", "")
                                break

                    if _is_meaningful_text(text):
                        return _clean_title(text)
                except (json.JSONDecodeError, TypeError):
                    continue
    except Exception:
        pass
    return "(제목 없음)"


def _parse_content(content) -> list[dict]:
    """메시지 content를 통일된 형식으로 파싱."""
    result = []
    if isinstance(content, str):
        if content.strip():
            result.append({"type": "text", "text": content})
    elif isinstance(content, list):
        for block in content:
            if isinstance(block, str):
                result.append({"type": "text", "text": block})
            elif isinstance(block, dict):
                btype = block.get("type", "")
                if btype == "text":
                    text = block.get("text", "")
                    if text.strip():
                        result.append({"type": "text", "text": text})
                elif btype == "tool_use":
                    result.append({
                        "type": "tool_use",
                        "name": block.get("name", ""),
                        "input_preview": str(block.get("input", {}))[:200],
                    })
                elif btype == "tool_result":
                    result.append({
                        "type": "tool_result",
                        "content_preview": str(block.get("content", ""))[:200],
                    })
    return result
