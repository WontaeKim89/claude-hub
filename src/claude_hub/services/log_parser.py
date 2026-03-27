"""세션 로그 파서 — JSONL에서 스킬/플러그인 사용 이벤트 추출."""
import json
import re
from pathlib import Path
from claude_hub.services.usage_db import UsageDB, BUILTIN_COMMANDS
from claude_hub.utils.paths import ClaudePaths

# harness가 slash command 실행 시 user message에 삽입하는 태그 패턴
_COMMAND_NAME_RE = re.compile(r"<command-name>/?([^<]+)</command-name>")


def parse_session_logs(paths: ClaudePaths, db: UsageDB) -> dict:
    """모든 프로젝트의 세션 로그를 파싱하여 DB에 기록."""
    stats = {"files_parsed": 0, "events_found": 0, "errors": 0}

    projects_dir = paths.projects_dir
    if not projects_dir.exists():
        return stats

    for jsonl_file in projects_dir.rglob("*.jsonl"):
        try:
            project = jsonl_file.parent.name
            found = _parse_single_file(jsonl_file, project, db)
            stats["files_parsed"] += 1
            stats["events_found"] += found
        except Exception:
            stats["errors"] += 1

    return stats


def _parse_single_file(path: Path, project: str, db: UsageDB) -> int:
    """단일 JSONL 파일에서 Skill 도구 호출을 추출. 추출된 이벤트 수 반환."""
    found = 0
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                found += _extract_skill_usage(entry, project, db)
            except json.JSONDecodeError:
                continue
    return found


def _extract_skill_usage(entry: dict, project: str, db: UsageDB) -> int:
    """JSONL 엔트리에서 Skill/Agent 사용 이벤트를 추출하여 DB 기록. 기록된 이벤트 수 반환."""
    msg = entry.get("message", entry)
    role = msg.get("role", "")
    session_id = str(entry.get("session_id", entry.get("sessionId", "")))
    count = 0

    # user message: harness가 slash command 실행 시 삽입하는 <command-name> 태그 감지
    if role == "user":
        content = msg.get("content", [])
        text = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
        for m in _COMMAND_NAME_RE.finditer(text):
            skill_name = m.group(1).strip()
            if skill_name and skill_name not in BUILTIN_COMMANDS:
                db.record_event(type="skill", name=skill_name, project=project, session_id=session_id)
                count += 1
        return count

    # assistant message: Skill/Agent tool_use 블록 감지
    if role != "assistant":
        return 0

    content = msg.get("content", [])
    if not isinstance(content, list):
        return 0

    for block in content:
        if not isinstance(block, dict) or block.get("type") != "tool_use":
            continue

        tool_name = block.get("name", "")
        tool_input = block.get("input", {})

        if tool_name == "Skill":
            skill_name = tool_input.get("skill", "") if isinstance(tool_input, dict) else ""
            if skill_name:
                db.record_event(type="skill", name=skill_name, project=project, session_id=session_id)
                count += 1

        elif tool_name == "Agent":
            subagent = tool_input.get("subagent_type", "") if isinstance(tool_input, dict) else ""
            if subagent:
                db.record_event(type="agent", name=subagent, project=project, session_id=session_id)
                count += 1

    return count
