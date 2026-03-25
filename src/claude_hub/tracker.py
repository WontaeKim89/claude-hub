"""Hook에서 호출되는 경량 tracker. stdin에서 JSON을 읽어 DB에 기록."""
import json
import sys
from claude_hub.services.usage_db import UsageDB


def main():
    """PostToolUse hook에서 호출됨. stdin으로 hook 데이터 수신."""
    try:
        data = json.load(sys.stdin)
        tool_name = data.get("tool_name", "")
        tool_input = data.get("tool_input", {})

        if isinstance(tool_input, str):
            try:
                tool_input = json.loads(tool_input)
            except json.JSONDecodeError:
                tool_input = {}

        event_type = None
        event_name = ""

        if tool_name == "Skill":
            event_type = "skill"
            event_name = tool_input.get("skill", "") if isinstance(tool_input, dict) else ""
        elif tool_name == "Agent":
            event_type = "agent"
            event_name = tool_input.get("subagent_type", "") if isinstance(tool_input, dict) else ""

        if not event_type or not event_name:
            return

        db = UsageDB()
        db.record_event(
            type=event_type,
            name=event_name,
            session_id=data.get("session_id", ""),
        )
    except Exception:
        # hook은 조용히 실패 — Claude Code 실행을 방해하지 않음
        pass


if __name__ == "__main__":
    main()
