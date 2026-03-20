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

        if tool_name != "Skill":
            return

        skill_name = ""
        if isinstance(tool_input, dict):
            skill_name = tool_input.get("skill", "")
        elif isinstance(tool_input, str):
            try:
                parsed = json.loads(tool_input)
                skill_name = parsed.get("skill", "")
            except json.JSONDecodeError:
                pass

        if not skill_name:
            return

        db = UsageDB()
        db.record_event(
            type="skill",
            name=skill_name,
            session_id=data.get("session_id", ""),
        )
    except Exception:
        # hook은 조용히 실패해야 함 — Claude Code 실행을 방해하지 않음
        pass


if __name__ == "__main__":
    main()
