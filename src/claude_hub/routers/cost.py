"""비용 추적 + 세션 모니터 API."""
from fastapi import APIRouter, Request

router = APIRouter(tags=["cost"])


@router.get("/cost/summary")
async def cost_summary(request: Request, days: int = 7):
    config = request.app.state.config
    from claude_hub.services.cost import CostService
    service = CostService(paths=config.paths)
    return service.get_summary(days)


@router.get("/cost/by-project")
async def cost_by_project(request: Request, days: int = 7):
    config = request.app.state.config
    from claude_hub.services.cost import CostService
    service = CostService(paths=config.paths)
    return service.get_by_project(days)


@router.get("/monitor/session")
async def current_session(request: Request):
    """현재 활성 세션 정보."""
    import json
    sessions_dir = request.app.state.config.paths.claude_dir / "sessions"
    active = []
    if sessions_dir.exists():
        for f in sessions_dir.glob("*.json"):
            try:
                data = json.loads(f.read_text())
                active.append(data)
            except Exception:
                continue
    return {"active_sessions": active}


@router.get("/monitor/recent-events")
async def recent_events(request: Request, limit: int = 50):
    """최근 세션 로그에서 도구 호출 이벤트 추출."""
    import json
    config = request.app.state.config

    events = []
    # 가장 최근 수정된 JSONL 파일 찾기
    jsonl_files = sorted(
        config.paths.projects_dir.rglob("*.jsonl"),
        key=lambda f: f.stat().st_mtime,
        reverse=True
    )

    for jsonl_file in jsonl_files[:3]:
        project = jsonl_file.parent.name
        try:
            with open(jsonl_file, "r", errors="ignore") as f:
                lines = f.readlines()
            # 마지막 N줄만 파싱
            for line in lines[-200:]:
                try:
                    entry = json.loads(line.strip())
                    msg = entry.get("message", entry)
                    content = msg.get("content", [])
                    if not isinstance(content, list):
                        continue
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "tool_use":
                            tool_name = block.get("name", "")
                            tool_input = block.get("input", {})
                            summary = ""
                            if tool_name == "Read":
                                summary = tool_input.get("file_path", "")[-60:] if isinstance(tool_input, dict) else ""
                            elif tool_name == "Write":
                                summary = tool_input.get("file_path", "")[-60:] if isinstance(tool_input, dict) else ""
                            elif tool_name == "Bash":
                                summary = (tool_input.get("command", "") if isinstance(tool_input, dict) else "")[:80]
                            elif tool_name == "Grep":
                                summary = tool_input.get("pattern", "") if isinstance(tool_input, dict) else ""
                            elif tool_name == "Skill":
                                summary = tool_input.get("skill", "") if isinstance(tool_input, dict) else ""
                            elif tool_name == "Agent":
                                summary = tool_input.get("description", "") if isinstance(tool_input, dict) else ""
                            elif tool_name == "Edit":
                                summary = (tool_input.get("file_path", "") if isinstance(tool_input, dict) else "")[-60:]
                            else:
                                summary = str(tool_input)[:60] if tool_input else ""

                            events.append({
                                "tool": tool_name,
                                "summary": summary,
                                "project": project,
                            })
                except (json.JSONDecodeError, TypeError):
                    continue
        except Exception:
            continue

    # 최신 이벤트가 마지막에 오도록 (역순)
    return {"events": events[-limit:]}
