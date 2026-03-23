"""Claude CLI 연결 상태 확인."""
from dataclasses import dataclass

from claude_hub.utils.claude_cli import run_claude


@dataclass
class ClaudeStatus:
    connected: bool
    version: str | None = None


def check_claude_connection() -> ClaudeStatus:
    try:
        result = run_claude("--version", timeout=5)
        if result.returncode == 0:
            return ClaudeStatus(connected=True, version=result.stdout.strip())
    except Exception:
        pass
    return ClaudeStatus(connected=False)
